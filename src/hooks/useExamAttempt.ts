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
  /** Proctoring: number of fullscreen/tab violations detected. */
  violations: number;
  /** Proctoring: true when a violation warning should be shown. */
  showViolationWarning: boolean;
  /** Proctoring: the most recent violation message. */
  violationMessage: string;
  /** Proctoring: true when exam is blocked — student exited fullscreen. */
  fullscreenBlocked: boolean;
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
    submitting: false,
    violations: 0,
    showViolationWarning: false,
    violationMessage: '',
    fullscreenBlocked: false
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
    // Answers are stored locally only — NOT sent to DB during the exam.
    // They are only sent to DB on submit or when an edit is requested.
    setState((prev) => ({
      ...prev,
      meta: { ...prev.meta, [questionId]: { locked: true, editGranted: false } }
    }));
    return true;
  }, []);

  const requestEdit = useCallback(async (questionId: string, reason: string) => {
    const snapshot = stateRef.current;
    if (!snapshot.attemptId) return false;
    try {
      // Send the current answer to DB along with the edit request
      // so staff can see what the student wants to change.
      const currentValue = snapshot.answers[questionId] ?? '';
      await api.requestEdit(snapshot.attemptId, questionId, reason, currentValue);
      toast.success('Modification request sent to examination staff.');
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  // --- Proctoring: fullscreen enforcement + violation tracking ---
  const requestFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const dismissWarning = useCallback(() => {
    setState((prev) => ({ ...prev, showViolationWarning: false }));
  }, []);

  /** Student clicks "Re-enter Fullscreen" on the blocking overlay. */
  const reEnterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* keep blocked — fullscreenchange listener will handle success */
    }
  }, []);

  // Auto-request fullscreen once the attempt loads.
  useEffect(() => {
    if (state.attemptId && !state.submitted) {
      const t = window.setTimeout(requestFullscreen, 300);
      return () => window.clearTimeout(t);
    }
  }, [state.attemptId, state.submitted, requestFullscreen]);

  // While blocked, any click or keypress tries to re-enter fullscreen.
  useEffect(() => {
    if (!state.fullscreenBlocked || state.submitted) return;
    const tryReenter = () => {
      if (!document.fullscreenElement && !stateRef.current.submitted) {
        document.documentElement.requestFullscreen?.().catch(() => undefined);
      }
    };
    window.addEventListener('click', tryReenter);
    window.addEventListener('keydown', tryReenter);
    return () => {
      window.removeEventListener('click', tryReenter);
      window.removeEventListener('keydown', tryReenter);
    };
  }, [state.fullscreenBlocked, state.submitted]);

  // Monitoring signals. These are observations + enforcement.
  useEffect(() => {
    const report = (type: string, detail: string) => {
      const snapshot = stateRef.current;
      if (!snapshot.attemptId || snapshot.submitted) return;
      api.reportEvent(type, detail, snapshot.attemptId).catch(() => undefined);
    };
    const bumpViolation = (message: string) => {
      setState((prev) => ({
        ...prev,
        violations: prev.violations + 1,
        showViolationWarning: true,
        violationMessage: message
      }));
    };

    const onVisibility = () => {
      if (document.hidden) {
        report('TAB_VISIBILITY_CHANGE', 'Tab hidden — exam left focus');
        bumpViolation('You switched tabs or windows. This has been reported to the examiner.');
      }
    };

    const onFullscreen = () => {
      if (document.fullscreenElement) {
        // Re-entered fullscreen — unblock the exam.
        setState((prev) => ({ ...prev, fullscreenBlocked: false }));
      } else if (!stateRef.current.submitted) {
        // Exited fullscreen — block + immediately try to re-enter.
        report('FULLSCREEN_EXIT', 'Left fullscreen mode');
        setState((prev) => ({
          ...prev,
          fullscreenBlocked: true,
          violations: prev.violations + 1,
          violationMessage: 'You exited fullscreen. The exam is blocked until you re-enter fullscreen or staff approves.'
        }));
        // Aggressively try to re-enter (works if triggered by user gesture).
        window.setTimeout(() => {
          if (!document.fullscreenElement && !stateRef.current.submitted) {
            document.documentElement.requestFullscreen?.().catch(() => undefined);
          }
        }, 100);
      }
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

    // Block keyboard shortcuts that could leave the page (Esc, Alt+Tab, Ctrl+Tab, Ctrl+W, F11, etc.)
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.submitted) return;
      // Esc, Ctrl+Tab, Ctrl+W, Ctrl+T, Ctrl+N, Alt+Tab, F11
      const blocked = (
        e.key === 'Escape' ||
        (e.ctrlKey && ['Tab', 'w', 't', 'n', 'Shift'].includes(e.key)) ||
        (e.altKey && e.key === 'Tab') ||
        e.key === 'F11'
      );
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        report('NAVIGATION_ATTEMPT', `Blocked key: ${e.key}`);
        if (e.key === 'Escape') {
          // Esc tries to exit fullscreen — aggressively re-enter.
          window.setTimeout(() => {
            if (!document.fullscreenElement && !stateRef.current.submitted) {
              document.documentElement.requestFullscreen?.().catch(() => undefined);
            }
          }, 100);
        } else {
          bumpViolation('Keyboard shortcuts that leave the exam are blocked.');
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return { state, setAnswer, goTo, toggleFlag, lockAnswer, requestEdit, submit, dismissWarning, reEnterFullscreen };
}