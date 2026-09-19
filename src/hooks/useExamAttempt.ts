import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiRequestError } from '../services/api';
import type { ExamQuestion } from '../components/QuestionCard';

const HEARTBEAT_MS = 10000;

export type SubmitReason = 'NORMAL' | 'TIME_EXPIRED' | 'FORCE_SUBMITTED';

interface AnswerMeta {
  locked: boolean;
  editGranted: boolean;
}

export interface ExamState {
  loading: boolean;
  error: string | null;
  attemptId: string | null;
  testName: string;
  deadline: string | null;
  serverOffsetMs: number;
  questions: ExamQuestion[];
  /** Working answers held in React only — never written to storage. */
  answers: Record<string, string>;
  meta: Record<string, AnswerMeta>;
  flagged: Record<string, boolean>;
  current: number;
  staffLocked: boolean;
  lockReason: string | null;
  submitted: false | SubmitReason;
  submitting: boolean;
}

export function useExamAttempt(testId: string) {
  const [state, setState] = useState<ExamState>({
    loading: true,
    error: null,
    attemptId: null,
    testName: '',
    deadline: null,
    serverOffsetMs: 0,
    questions: [],
    answers: {},
    meta: {},
    flagged: {},
    current: 0,
    staffLocked: false,
    lockReason: null,
    submitted: false,
    submitting: false
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Guards against a second submit racing in before React state settles.
  const submittingRef = useRef(false);

  const applyPayload = useCallback((payload: any) => {
    const answers: Record<string, string> = {};
    const meta: Record<string, AnswerMeta> = {};
    payload.answers.forEach((a: any) => {
      answers[a.questionId] = a.value;
      meta[a.questionId] = { locked: a.locked, editGranted: a.editGranted };
    });
    setState((prev) => ({
      ...prev,
      loading: false,
      error: null,
      attemptId: payload.attempt.id,
      testName: payload.test.name,
      deadline: payload.attempt.deadline,
      serverOffsetMs: new Date(payload.serverTime).getTime() - Date.now(),
      questions: payload.questions,
      answers: { ...answers },
      meta,
      current: payload.attempt.currentQuestion ?? 0,
      staffLocked: payload.attempt.status === 'LOCKED',
      lockReason: payload.attempt.lockReason
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.
    startTest(testId).
    then((payload) => {
      if (!cancelled) applyPayload(payload);
    }).
    catch((err) => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: err.message }));
    });
    return () => {
      cancelled = true;
    };
  }, [testId, applyPayload]);

  const submit = useCallback(
    async (reason: SubmitReason) => {
      const snapshot = stateRef.current;
      if (!snapshot.attemptId || snapshot.submitted || snapshot.submitting || submittingRef.current) return;
      submittingRef.current = true;
      setState((prev) => ({ ...prev, submitting: true }));
      try {
        const res = await api.submitAttempt(snapshot.attemptId, snapshot.answers, reason);
        submittingRef.current = false;
        setState((prev) => ({ ...prev, submitting: false, submitted: res.reason ?? reason }));
      } catch (err) {
        submittingRef.current = false;
        // The server already finalised the attempt (deadline or staff action): this is
        // the good kind of failure — the exam is simply over.
        if ((err as ApiRequestError).status === 409) {
          setState((prev) => ({ ...prev, submitting: false, submitted: reason }));
          return;
        }
        setState((prev) => ({ ...prev, submitting: false }));
        toast.error((err as Error).message);
      }
    },
    []
  );

  // Server-authoritative control channel: lock, force submit, edit grants.
  useEffect(() => {
    const id = window.setInterval(async () => {
      const snapshot = stateRef.current;
      if (!snapshot.attemptId || snapshot.submitted) return;
      try {
        const answered = Object.values(snapshot.answers).filter((v) => v.trim()).length;
        const res = await api.heartbeat(snapshot.attemptId, snapshot.current, answered);
        if (res.forceSubmit) {
          await submit('FORCE_SUBMITTED');
          return;
        }
        setState((prev) => {
          const meta = { ...prev.meta };
          res.editGrants.forEach((qid: string) => {
            meta[qid] = { locked: true, editGranted: true };
          });
          return {
            ...prev,
            meta,
            deadline: res.deadline ?? prev.deadline,
            serverOffsetMs: new Date(res.serverTime).getTime() - Date.now(),
            staffLocked: Boolean(res.locked),
            lockReason: res.lockReason ?? null
          };
        });
      } catch {

        /* transient network issue — the next beat retries */}
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [submit]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setState((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: value } }));
  }, []);

  const goTo = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      current: Math.min(Math.max(index, 0), prev.questions.length - 1)
    }));
  }, []);

  const toggleFlag = useCallback((questionId: string) => {
    setState((prev) => ({
      ...prev,
      flagged: { ...prev.flagged, [questionId]: !prev.flagged[questionId] }
    }));
  }, []);

  const lockAnswer = useCallback(async (questionId: string) => {
    const snapshot = stateRef.current;
    if (!snapshot.attemptId) return false;
    try {
      await api.lockAnswer(snapshot.attemptId, questionId, snapshot.answers[questionId] ?? '');
      setState((prev) => ({
        ...prev,
        meta: { ...prev.meta, [questionId]: { locked: true, editGranted: false } }
      }));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  const requestEdit = useCallback(async (questionId: string, reason: string) => {
    const snapshot = stateRef.current;
    if (!snapshot.attemptId) return false;
    try {
      await api.requestEdit(snapshot.attemptId, questionId, reason);
      toast.success('Modification request sent to examination staff.');
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  // Monitoring signals. These are observations, not cheating prevention.
  useEffect(() => {
    const report = (type: string, detail: string) => {
      const snapshot = stateRef.current;
      if (!snapshot.attemptId || snapshot.submitted) return;
      api.reportEvent(type, detail, snapshot.attemptId).catch(() => undefined);
    };
    const onVisibility = () =>
    report('TAB_VISIBILITY_CHANGE', document.hidden ? 'Tab hidden' : 'Tab visible');
    const onFullscreen = () => {
      if (!document.fullscreenElement) report('FULLSCREEN_EXIT', 'Left fullscreen mode');
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      report('CONTEXT_MENU_BLOCKED', 'Right click blocked');
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stateRef.current.submitted) return;
      report('NAVIGATION_ATTEMPT', 'Tried to leave the exam page');
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  return { state, setAnswer, goTo, toggleFlag, lockAnswer, requestEdit, submit };
}