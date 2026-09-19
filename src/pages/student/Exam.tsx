import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  LockIcon,
  MaximizeIcon,
  PencilLineIcon,
  ShieldAlertIcon,
  XIcon,
  FileTextIcon,
} from 'lucide-react';
import { DesktopOnlyGate } from '../../components/DesktopOnlyGate';
import { ExamTimer } from '../../components/ExamTimer';
import { QuestionCard } from '../../components/QuestionCard';
import { QuestionNavigator, type QuestionState } from '../../components/QuestionNavigator';
import { BrandMark } from '../../components/BrandMark';
import { GlobalFooter } from '../../components/GlobalFooter';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { useExamAttempt } from '../../hooks/useExamAttempt';
import { useAuth } from '../../contexts/AuthContext';
import { titleCase } from '../../utils/format';

export function Exam() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { state, setAnswer, goTo, toggleFlag, lockAnswer, requestEdit, submit } = useExamAttempt(id);
  const [lockedDialog, setLockedDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const question = state.questions[state.current];
  const meta = question ? state.meta[question.id] : undefined;

  const navStates: QuestionState[] = useMemo(
    () =>
      state.questions.map((q, index) => {
        if (index === state.current) return 'current';
        if (state.flagged[q.id]) return 'flagged';
        const m = state.meta[q.id];
        if (m?.locked && !m.editGranted) return 'locked';
        if ((state.answers[q.id] ?? '').trim()) return 'answered';
        return 'unanswered';
      }),
    [state.questions, state.current, state.flagged, state.meta, state.answers]
  );

  const counts = useMemo(() => {
    const base: Record<QuestionState, number> = {
      current: 0,
      answered: 0,
      locked: 0,
      flagged: 0,
      unanswered: 0,
    };
    navStates.forEach((s) => {
      base[s] += 1;
    });
    return base;
  }, [navStates]);

  const handleLockNext = async () => {
    if (!question) return;
    const ok = await lockAnswer(question.id);
    if (ok) setLockedDialog(true);
  };

  const closeLockedDialog = () => {
    setLockedDialog(false);
    if (state.current < state.questions.length - 1) goTo(state.current + 1);
  };

  const sendEditRequest = async () => {
    if (!question) return;
    const ok = await requestEdit(question.id, editReason);
    if (ok) {
      setEditDialog(false);
      setEditReason('');
    }
  };

  if (state.loading) return <LoadingState label="Preparing your question set…" />;
  if (state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md p-6">
          <ErrorState title="Test unavailable" message={state.error} />
          <div className="mt-4 text-center">
            <Button variant="secondary" onClick={() => navigate('/student')}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* Test Submitted Successfully Screen (Middle Far-Right in reference) */
  if (state.submitted) {
    return (
      <div className="min-h-screen w-full bg-[#080d1f] flex flex-col justify-between text-white relative isolate overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_35%,rgba(16,185,129,0.15),transparent)]" />

        {/* Top Header */}
        <header className="flex h-18 items-center border-b border-white/10 px-8">
          <BrandMark tone="light" />
        </header>

        {/* Centered Success Card */}
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d162f]/90 p-10 text-center shadow-2xl backdrop-blur-md">
            {/* Big Glowing Checkmark Icon */}
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400/40 shadow-lg shadow-emerald-500/20">
              <CheckCircle2Icon className="h-10 w-10" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Test Submitted Successfully!
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-300 max-w-sm mx-auto">
              Your answers have been recorded. Results will be available as per event schedule.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/student')}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500"
              >
                View Dashboard
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-7 py-3 text-sm font-bold text-slate-300 transition-all hover:bg-white/15 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </main>

        <GlobalFooter />
      </div>
    );
  }

  return (
    <DesktopOnlyGate>
      <div className="flex h-screen w-full flex-col bg-[#f8fafc]">
        {/* Dark Navy Header */}
        <header className="flex h-18 shrink-0 items-center justify-between gap-6 bg-[#0a1026] px-6 text-white border-b border-slate-800">
          <div className="flex items-center gap-4">
            <BrandMark tone="light" />
            <span className="h-6 w-px bg-white/20 hidden sm:block" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-200 hidden sm:block">
              {state.testName || 'Python Fundamentals'}
            </span>
          </div>

          <div className="flex items-center gap-6">
            {/* Countdown Timer with Glow */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <ExamTimer
                deadline={state.deadline}
                serverOffsetMs={state.serverOffsetMs}
                onExpire={() => submit('TIME_EXPIRED')}
              />
            </div>

            <button
              type="button"
              onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Enter fullscreen"
            >
              <MaximizeIcon className="h-4 w-4" />
            </button>

            {/* End Test Button */}
            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-red-600/30 hover:bg-red-500 transition-colors"
            >
              End Test
            </button>
          </div>
        </header>

        {/* 2-Column Exam Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left Question Navigator */}
          <aside className="w-72 shrink-0 border-r border-slate-200 bg-white p-5">
            <QuestionNavigator states={navStates} counts={counts} onSelect={goTo} />
          </aside>

          {/* Right Active Question & Navigation Controls */}
          <main className="fc-scroll min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="mx-auto max-w-3xl space-y-6">
              {question ? (
                <>
                  <QuestionCard
                    index={state.current}
                    question={question}
                    value={state.answers[question.id] ?? ''}
                    locked={Boolean(meta?.locked)}
                    editGranted={Boolean(meta?.editGranted)}
                    flagged={Boolean(state.flagged[question.id])}
                    onChange={(value) => setAnswer(question.id, value)}
                    onToggleFlag={() => toggleFlag(question.id)}
                  />

                  {/* Navigation Bar */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={state.current === 0}
                      onClick={() => goTo(state.current - 1)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      Previous
                    </button>

                    <div className="flex items-center gap-3">
                      {meta?.locked && !meta.editGranted ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditDialog(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                          >
                            <PencilLineIcon className="h-4 w-4" />
                            Request modification
                          </button>
                          <button
                            type="button"
                            disabled={state.current === state.questions.length - 1}
                            onClick={() => goTo(state.current + 1)}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 disabled:opacity-40"
                          >
                            Next
                            <ArrowRightIcon className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={handleLockNext}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.01] transition-all"
                        >
                          Lock & Next
                          <ArrowRightIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </main>
        </div>

        {/* Modal 1: Answer Locked (Screen 5 in reference) */}
        {lockedDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl animate-in fade-in zoom-in-95">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100">
                <LockIcon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-extrabold text-navy-900">Answer Locked</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Your answer has been saved and locked. You cannot edit it now.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={closeLockedDialog}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLockedDialog(false);
                    setEditDialog(true);
                  }}
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Request Modification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Request Answer Change (Screen 6 in reference) */}
        {editDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                    <FileTextIcon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-bold text-navy-900">Request Answer Change</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditDialog(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    Question {state.current + 1}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Current Answer: <strong className="text-navy-900">{question ? state.answers[question.id] || 'None' : 'None'}</strong>
                  </span>
                </div>

                <div>
                  <textarea
                    rows={4}
                    maxLength={200}
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Enter reason for change (optional)..."
                    className="w-full rounded-xl border border-slate-200 p-3.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="mt-1 text-right text-xs text-slate-400">
                    {editReason.length}/200
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditDialog(false)}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendEditRequest}
                    className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirm Dialog */}
        <ConfirmDialog
          open={confirmSubmit}
          title="Submit your test?"
          destructive
          confirmLabel="Submit test"
          loading={state.submitting}
          message={
            <>
              You have answered{' '}
              <strong>{Object.values(state.answers).filter((v) => v.trim()).length}</strong> of{' '}
              <strong>{state.questions.length}</strong> questions. Once submitted, your answers will be
              finalised on the server.
            </>
          }
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={async () => {
            setConfirmSubmit(false);
            await submit('NORMAL');
          }}
        />
      </div>
    </DesktopOnlyGate>
  );
}