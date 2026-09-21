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
  /** Proctoring: true when DevTools detected open. */
  devtoolsOpen: boolean;
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
    fullscreenBlocked: false,
    devtoolsOpen: false,
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

  const submitRef = useRef(submit);
  submitRef.current = submit;

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

    const doLock = (reason: string, detail: string) => {
      if (stateRef.current.submitted || stateRef.current.fullscreenBlocked) return;
      report(reason, detail);
      bumpViolation(detail);
      setState((prev) => ({ ...prev, fullscreenBlocked: true, violationMessage: detail }));
    };

    const onVisibility = () => {
      if (document.hidden && !stateRef.current.submitted) {
        doLock('TAB_VISIBILITY_CHANGE', 'You switched tabs or minimized. The exam is locked until staff unlocks it.');
      }
    };
    const onBlur = () => {
      if (document.hidden || stateRef.current.submitted) return;
      // Any window blur (Alt+Tab, click outside, multitask) → lock
      doLock('WINDOW_BLUR', 'You left the exam window (multitasking detected). The exam is locked until staff unlocks it.');
    };
    const onPageHide = () => {
      if (!stateRef.current.submitted) doLock('PAGE_HIDE', 'You navigated away. The exam is locked.');
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

    // Banking-style: block all DevTools / navigation / clipboard / print shortcuts
    // USE CAPTURE PHASE (true) — fires before browser processes the event
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.submitted) return;

      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Block ALL function keys (F1-F12) — covers F12 DevTools, F5 reload, etc.
      if (/^F\d{1,2}$/.test(key)) {
        e.preventDefault(); e.stopPropagation();
        e.stopImmediatePropagation();
        report('DEVTOOLS_ATTEMPT', `Blocked function key: ${key}`);
        bumpViolation(`${key} is blocked during the exam.`);
        return;
      }
      // Esc — exit fullscreen → aggressively re-enter
      if (key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        e.stopImmediatePropagation();
        report('NAVIGATION_ATTEMPT', 'Escape blocked');
        window.setTimeout(() => {
          if (!document.fullscreenElement && !stateRef.current.submitted) {
            document.documentElement.requestFullscreen?.().catch(() => undefined);
          }
        }, 100);
        return;
      }
      // Ctrl/Cmd + key combos — block everything dangerous
      if (ctrl) {
        const blockList = [
          'Tab', 'w', 't', 'n', 'r', 'R',
          'i', 'I', 'j', 'J', 'c', 'C',
          'u', 'U', 's', 'S', 'p', 'P',
          'l', 'L', 'f', 'F', 'h', 'H',
          'a', 'A', 'b', 'B', 'd', 'D',
          'g', 'G', 'o', 'O',
        ];
        if (shift) {
          blockList.push('i', 'I', 'j', 'J', 'c', 'C', 'r', 'R', 'Delete', 'N');
        }
        if (blockList.includes(key)) {
          e.preventDefault(); e.stopPropagation();
          e.stopImmediatePropagation();
          report('DEVTOOLS_ATTEMPT', `Blocked Ctrl+${shift ? 'Shift+' : ''}${key}`);
          bumpViolation('This keyboard shortcut is blocked during the exam.');
          return;
        }
      }
      // Alt key combos
      if (alt) {
        e.preventDefault(); e.stopPropagation();
        e.stopImmediatePropagation();
        report('NAVIGATION_ATTEMPT', `Blocked Alt+${key}`);
        bumpViolation('Alt shortcuts are blocked during the exam.');
        return;
      }
      // PrintScreen
      if (key === 'PrintScreen') {
        e.preventDefault(); e.stopPropagation();
        e.stopImmediatePropagation();
        report('SCREEN_CAPTURE', 'PrintScreen blocked');
        bumpViolation('Screenshots are blocked during the exam.');
        return;
      }
    };

    // Block clipboard paste (prevent pasting answers from external sources)
    const onPaste = (e: ClipboardEvent) => {
      if (stateRef.current.submitted) return;
      e.preventDefault();
      report('CLIPBOARD_BLOCKED', 'Paste blocked during exam');
    };

    // Block clipboard copy (prevent copying questions out)
    const onCopy = (e: ClipboardEvent) => {
      if (stateRef.current.submitted) return;
      e.preventDefault();
      report('CLIPBOARD_BLOCKED', 'Copy blocked during exam');
    };

    // Block cut
    const onCut = (e: ClipboardEvent) => {
      if (stateRef.current.submitted) return;
      e.preventDefault();
      report('CLIPBOARD_BLOCKED', 'Cut blocked during exam');
    };

    // Block drag (prevent dragging question text out)
    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // Banking-style DevTools detection (runs every 500ms for fast response)
    let devtoolsDetected = false;
    let devtoolsViolationCount = 0;
    const detectDevTools = () => {
      if (stateRef.current.submitted) return;

      // Method 1: Window size difference (detects docked DevTools)
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const threshold = 150;

      const isOpen = widthDiff > threshold || heightDiff > threshold;

      if (isOpen && !devtoolsDetected) {
        devtoolsDetected = true;
        devtoolsViolationCount++;
        report('DEVTOOLS_ATTEMPT', `DevTools detected via window size (${widthDiff}x${heightDiff}) #${devtoolsViolationCount}`);
        bumpViolation('Developer Tools detected! Close DevTools immediately.');
        setState((prev) => ({ ...prev, devtoolsOpen: true }));

        // Auto-submit after 3 DevTools detections
        if (devtoolsViolationCount >= 3) {
          report('DEVTOOLS_AUTO_SUBMIT', `Auto-submit after ${devtoolsViolationCount} DevTools violations`);
          bumpViolation('Too many DevTools violations. Auto-submitting your exam.');
          // Trigger auto-submit
          setTimeout(() => {
            if (!stateRef.current.submitted) {
              submitRef.current('FORCE_SUBMITTED');
            }
          }, 2000);
        }
      } else if (!isOpen && devtoolsDetected) {
        devtoolsDetected = false;
        setState((prev) => ({ ...prev, devtoolsOpen: false }));
      }

      // Method 2: Debugger timing (detects undocked DevTools)
      if (!devtoolsDetected) {
        const start = performance.now();
        // eslint-disable-next-line no-debugger
        debugger;
        const elapsed = performance.now() - start;
        if (elapsed > 80) {
          devtoolsDetected = true;
          devtoolsViolationCount++;
          report('DEVTOOLS_ATTEMPT', `DevTools detected via debugger timing #${devtoolsViolationCount}`);
          bumpViolation('Developer Tools detected! Close DevTools immediately.');
          setState((prev) => ({ ...prev, devtoolsOpen: true }));

          if (devtoolsViolationCount >= 3) {
            report('DEVTOOLS_AUTO_SUBMIT', `Auto-submit after ${devtoolsViolationCount} DevTools violations`);
            bumpViolation('Too many DevTools violations. Auto-submitting your exam.');
            setTimeout(() => {
              if (!stateRef.current.submitted) {
                submitRef.current('FORCE_SUBMITTED');
              }
            }, 2000);
          }
        }
      }
    };

    const devtoolsInterval = window.setInterval(detectDevTools, 500);

    // Multitask / focus-loss polling — catches Alt+Tab, Win+Tab, split-screen, clicking outside
    const focusInterval = window.setInterval(() => {
      if (!document.hasFocus() && !document.hidden && !stateRef.current.submitted && !stateRef.current.fullscreenBlocked) {
        doLock('FOCUS_LOST', 'You left the exam window (multitasking detected). The exam is locked until staff unlocks it.');
      }
    }, 700);

    const onResize = () => {
      if (!document.fullscreenElement && !stateRef.current.submitted && !stateRef.current.fullscreenBlocked && document.hasFocus()) {
        const isSplit = window.outerWidth < window.screen.width * 0.9 || window.outerHeight < window.screen.height * 0.9;
        if (isSplit) report('WINDOW_RESIZE', `Window resized ${window.outerWidth}x${window.outerHeight}`);
      }
    };

    // Override console methods to make DevTools console useless
    const noop = (..._args: unknown[]) => undefined;
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const origInfo = console.info;
    const origDebug = console.debug;
    const origTable = console.table;
    const origClear = console.clear;
    console.log = noop;
    console.warn = noop;
    console.error = noop;
    console.info = noop;
    console.debug = noop;
    console.table = noop;
    console.clear = noop;

    // Disable debugger statement override (prevent devs bypass)
    const origDefineProperty = Object.defineProperty;

    // USE CAPTURE PHASE for all event listeners (fires before browser)
    document.addEventListener('visibilitychange', onVisibility, true);
    document.addEventListener('fullscreenchange', onFullscreen, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('beforeunload', onBeforeUnload, true);
    window.addEventListener('blur', onBlur, true);
    window.addEventListener('pagehide', onPageHide, true);
    window.addEventListener('resize', onResize, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);
    window.addEventListener('keypress', (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }, true);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('cut', onCut, true);
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('selectstart', (e) => {
      e.preventDefault();
    }, true);
    return () => {
      window.clearInterval(devtoolsInterval);
      window.clearInterval(focusInterval);
      // Restore console
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
      console.info = origInfo;
      console.debug = origDebug;
      console.table = origTable;
      console.clear = origClear;
      document.removeEventListener('visibilitychange', onVisibility, true);
      document.removeEventListener('fullscreenchange', onFullscreen, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('beforeunload', onBeforeUnload, true);
      window.removeEventListener('blur', onBlur, true);
      window.removeEventListener('pagehide', onPageHide, true);
      window.removeEventListener('resize', onResize, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('cut', onCut, true);
      document.removeEventListener('dragstart', onDragStart, true);
    };
  }, []);

  return { state, setAnswer, goTo, toggleFlag, lockAnswer, requestEdit, submit, dismissWarning, reEnterFullscreen };
}