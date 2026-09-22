import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarIcon,
  ClockIcon,
  CodeXmlIcon,
  AlertCircleIcon,
  MapPinIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  CalendarClockIcon,
  ClipboardListIcon,
} from 'lucide-react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { studentNav } from './studentNav';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import { eventConfig, guidelines } from '../../data/eventConfig';
import { formatDateTime } from '../../utils/format';

const POLL_INTERVAL_MS = 15000;

export function StudentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.studentDashboard();
      setData(res);
      setError(null);
    } catch (err) {
      if (initial) {
        setError((err as Error).message);
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  const { mode } = useLive({ intervalMs: POLL_INTERVAL_MS, onEvent: () => load(false), channel: 'student-dashboard' });

  useEffect(() => {
    load(true);
  }, [load]);

  const studentName = data?.student?.name ?? 'Student';

  const tests: any[] = data?.tests ?? [];
  const test = tests.find((t) => t.status === 'ACTIVE' || t.status === 'PAUSED') ?? tests[0] ?? null;
  const testName = test?.name ?? 'Untitled test';
  const testStatus = test?.status ?? 'SCHEDULED';
  const live = testStatus === 'ACTIVE';
  const paused = testStatus === 'PAUSED';
  const chip =
    live
      ? { label: 'Live now', cls: 'bg-emerald-500' }
      : paused
        ? { label: 'Paused by staff', cls: 'bg-amber-500' }
        : testStatus === 'COMPLETED'
          ? { label: 'Completed', cls: 'bg-slate-400' }
          : { label: 'Scheduled', cls: 'bg-slate-400' };
  const questionCount = test?.questionCount ?? 0;
  const durationMinutes = test?.durationMinutes ?? 0;
  const scheduledStart = test?.scheduledStart ? formatDateTime(test.scheduledStart) : null;

  const canEnter = Boolean(test?.id);

  return (
    <PortalLayout
      portalLabel="Student Portal"
      navItems={studentNav}
    >
      {loading ? (
        <LoadingState label="Loading your dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Welcome Greeting Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-navy-900 tracking-tight flex items-center gap-2">
                Welcome, {studentName}
              </h1>
              <p className="mt-1 text-sm text-slate-500 font-medium">
                Ready to test your skills? Keep going!
              </p>
            </div>

            <div className="shrink-0 space-x-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                <CheckCircle2Icon className="h-4 w-4 text-slate-400" />
                Eligible Participant
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                {mode === 'live' ? 'Live · instant updates' : 'Auto-refreshes every 15s'}
              </span>
            </div>
          </div>

          {test ? (
            <div className="rounded-2xl bg-white p-6 sm:p-7 shadow-sm ring-1 ring-black/5 transition-all hover:ring-black/10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-white shadow-md">
                    <CodeXmlIcon className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-xl font-semibold text-navy-900">{testName}</h2>
                      <span className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-black/10`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${chip.cls}`} />
                        {chip.label}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">{eventConfig.name}</p>

                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <CalendarIcon className="h-4 w-4 text-slate-400" />
                        {eventConfig.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <ClockIcon className="h-4 w-4 text-slate-400" />
                        {eventConfig.time}
                      </span>
                      {scheduledStart && (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <CalendarClockIcon className="h-4 w-4 text-slate-400" />
                          {live ? `Live since ${scheduledStart}` : paused ? `Paused · started ${scheduledStart}` : `Starts ${scheduledStart}`}
                        </span>
)}

          {tests.length > 1 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h3 className="text-base font-semibold text-navy-900">All your tests</h3>
              <ul className="mt-4 divide-y divide-slate-100">
                {tests.map((t) => {
                  const liveChip = t.status === 'ACTIVE';
                  const pausedChip = t.status === 'PAUSED';
                  const chipCls = liveChip ? 'bg-emerald-500' : pausedChip ? 'bg-amber-500' : t.status === 'COMPLETED' ? 'bg-slate-400' : 'bg-slate-400';
                  const chipLabel = liveChip ? 'Live now' : pausedChip ? 'Paused by staff' : t.status === 'COMPLETED' ? 'Completed' : t.status === 'DRAFT' ? 'Draft' : t.status === 'ARCHIVED' ? 'Archived' : 'Scheduled';
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'currentColor', color: liveChip ? '#10b981' : pausedChip ? '#f59e0b' : '#94a3b8' }} />
                        <span className="truncate text-sm font-medium text-navy-900">{t.name}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-black/10`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${chipCls}`} />
                          {chipLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => t.id && navigate(`/student/tests/${t.id}/waiting`)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Enter Test
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <MapPinIcon className="h-4 w-4 text-slate-400" />
                        {eventConfig.venueBlock}, {eventConfig.venueRooms}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 border-t lg:border-t-0 pt-4 lg:pt-0 border-black/5">
                  <div className="text-center px-2">
                    <p className="text-2xl font-semibold text-navy-900 tabular-nums">{questionCount}</p>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Questions
                    </p>
                  </div>
                  <div className="text-center px-2">
                    <p className="text-2xl font-semibold text-navy-900 tabular-nums">{durationMinutes}</p>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Minutes
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEnter}
                    onClick={() => {
                      if (!test.id) return;
                      navigate(`/student/tests/${test.id}/waiting`);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Enter Test
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ClipboardListIcon className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-navy-900">No test assigned yet</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Tests are scheduled by the examination staff. Check back closer to the event — once a
                test is assigned, it appears here with its schedule.
              </p>
            </div>
          )}

          {/* Important Instructions Card with Student Illustration */}
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-7 shadow-sm ring-1 ring-black/5">
            <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr] items-center">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-navy-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-navy-900">
                    <AlertCircleIcon className="h-4 w-4" />
                  </span>
                  Important Instructions
                </h3>

                <ul className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                    <span>Use a PC or laptop. Mobile devices are not allowed.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                    <span>Ensure a stable internet connection.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                    <span>Do not refresh the page during the test.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                    <span>Once an answer is locked, it cannot be edited without staff approval.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                    <span>Follow all event rules and guidelines.</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-center items-center">
                <svg
                  viewBox="0 0 200 160"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-48 h-auto drop-shadow-sm"
                >
                  <rect x="20" y="130" width="160" height="8" rx="4" fill="#CBD5E1" />
                  <rect x="55" y="122" width="70" height="8" rx="2" fill="#3B82F6" />
                  <path d="M60 75 L120 75 L125 122 L55 122 Z" fill="#2563EB" />
                  <path d="M64 80 L116 80 L120 118 L60 118 Z" fill="#93C5FD" />
                  <rect x="68" y="86" width="30" height="3" rx="1.5" fill="#1E3A8A" />
                  <rect x="68" y="93" width="40" height="3" rx="1.5" fill="#1E3A8A" />
                  <rect x="68" y="100" width="22" height="3" rx="1.5" fill="#10B981" />
                  <circle cx="145" cy="55" r="16" fill="#FBBF24" />
                  <path d="M130 50 C130 38 160 38 160 50 C155 45 135 45 130 50 Z" fill="#1E293B" />
                  <path d="M125 76 C125 71 165 71 165 76 L170 120 L120 120 Z" fill="#3B82F6" />
                  <path d="M125 85 Q115 110 95 118" stroke="#FBBF24" strokeWidth="8" strokeLinecap="round" />
                  <path d="M145 85 Q125 115 110 120" stroke="#FBBF24" strokeWidth="8" strokeLinecap="round" />
                  <circle cx="105" cy="40" r="4" fill="#38BDF8" />
                  <circle cx="95" cy="30" r="6" fill="#60A5FA" />
                  <text x="95" y="33" textAnchor="middle" fill="#FFFFFF" fontSize="6" fontWeight="bold">&lt;/&gt;</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}