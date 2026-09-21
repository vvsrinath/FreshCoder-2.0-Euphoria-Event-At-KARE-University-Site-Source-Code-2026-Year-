import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UsersIcon,
  ActivityIcon,
  CheckCircle2Icon,
  PencilLineIcon,
  ClockIcon,
  PlusIcon,
  PlayIcon,
  FileBarChart2Icon,
} from 'lucide-react';
import { PortalLayout } from '../../components/PortalLayout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { StatCard } from '../../components/StatCard';
import { StaffNavFooter, staffNav } from './staffNav';
import { StaffAnnouncements } from './StaffAnnouncements';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import type { Test } from '../../types';

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-white text-slate-700 ring-1 ring-inset ring-black/10',
  PAUSED: 'bg-white text-slate-700 ring-1 ring-inset ring-black/10',
  SCHEDULED: 'bg-white text-slate-700 ring-1 ring-inset ring-black/10',
  DRAFT: 'bg-white text-slate-500 ring-1 ring-inset ring-black/10',
  COMPLETED: 'bg-white text-slate-700 ring-1 ring-inset ring-black/10',
  ARCHIVED: 'bg-white text-slate-500 ring-1 ring-inset ring-black/10',
};

export function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [live, setLive] = useState<any>(null);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .staffDashboard()
      .then((res) => setData(res))
      .catch((err) => setError(err.message));
  }, []);

  const refreshTests = useCallback(() => {
    api.tests().then((res) => setTests(res.tests)).catch(() => undefined);
  }, []);

  const { mode } = useLive({
    intervalMs: 15000,
    onEvent: () => {
      load();
      refreshTests();
    },
    channel: 'staff-dashboard',
  });

  useEffect(() => {
    refreshTests();
    load();
  }, [load, refreshTests]);

  useEffect(() => {
    if (!runningTestId) return;
    const refresh = () => api.live({ testId: runningTestId }).then(setLive).catch(() => undefined);
    refresh();
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [runningTestId]);

  useEffect(() => {
    const running = tests.find((t) => ['ACTIVE', 'PAUSED'].includes(t.status));
    setRunningTestId(running?.id ?? null);
    if (!running) setLive(null);
  }, [tests]);

  useEffect(() => {
    if (data) setLoading(false);
  }, [data]);

  const stats = data?.stats;
  const upcoming = tests.filter((t) => t.status === 'SCHEDULED').slice(0, 4);
  const running = tests.find((t) => ['ACTIVE', 'PAUSED'].includes(t.status));

  return (
    <PortalLayout
      portalLabel="Staff Portal"
      navItems={staffNav}
      navFooter={<StaffNavFooter />}
    >
      {loading && !data ? (
        <LoadingState label="Loading dashboard…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-navy-900 tracking-tight">
                Welcome, {user?.name?.split(' ')[0] || 'Staff'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                {mode === 'live'
                  ? 'Live dashboard — changes appear instantly.'
                  : 'Live examination controls and activity across Fresh Coders 2.0 – Euphoria 2026.'}
              </p>
            </div>
            <Link
              to="/staff/tests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              New test
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total students"
              value={stats?.totalStudents ?? 0}
              icon={<UsersIcon className="h-4 w-4" />}
              hint={`${stats?.activeStudents ?? 0} active accounts`}
            />
            <StatCard
              label="Active now"
              value={stats?.inProgress ?? 0}
              icon={<ActivityIcon className="h-4 w-4" />}
              tone="success"
              hint={`${stats?.locked ?? 0} locked · ${stats?.disconnected ?? 0} disconnected`}
            />
            <StatCard
              label="Submitted"
              value={stats?.submitted ?? 0}
              icon={<CheckCircle2Icon className="h-4 w-4" />}
              tone="brand"
              hint="completed attempts"
            />
            <StatCard
              label="Pending requests"
              value={stats?.editRequests ?? 0}
              icon={<PencilLineIcon className="h-4 w-4" />}
              tone={Number(stats?.editRequests ?? 0) > 0 ? 'danger' : 'default'}
              hint="answer change requests"
            />
          </div>

          {running ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live test</p>
                    <h2 className="text-lg font-semibold text-navy-900">{running.name}</h2>
                  </div>
                </div>
                <Link
                  to={`/staff/tests/${running.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
                >
                  <ActivityIcon className="h-4 w-4" />
                  Monitor live
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-semibold text-navy-900 tabular-nums">{live?.stats?.active ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Writing now</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-navy-900 tabular-nums">{live?.stats?.submitted ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Submitted</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-navy-900 tabular-nums">{live?.stats?.locked ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Locked</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-navy-900 tabular-nums">{live?.stats?.securityEvents ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Security flags</p>
                </div>
              </div>
            </div>
          ) : upcoming.length > 0 ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-3">
                <ClockIcon className="h-5 w-5 text-slate-400" />
                <h2 className="text-base font-semibold text-navy-900">Upcoming tests</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {upcoming.map((t) => (
                  <Link
                    key={t.id}
                    to={`/staff/tests/${t.id}`}
                    className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-black/5 hover:ring-black/15 transition-colors"
                  >
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[t.status]}`}>
                      {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                    </span>
                    <p className="mt-2 truncate text-sm font-semibold text-navy-900">{t.name}</p>
                    <p className="text-xs text-slate-500">Starts {formatWhen(t.scheduledStart)}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <StaffAnnouncements />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900 mb-4">
                <ClockIcon className="h-4 w-4 text-slate-400" />
                Recent activity
              </h2>
              <div className="divide-y divide-black/5">
                {(data?.activity ?? []).length === 0 ? (
                  <p className="py-4 text-sm text-slate-400">No activity recorded yet.</p>
                ) : (
                  data.activity.map((act: any, index: number) => (
                    <div key={act.id ?? index} className="py-3 text-xs sm:text-sm">
                      <p className="font-semibold text-slate-800">{act.action}</p>
                      <p className="text-slate-400">
                        {act.actor} · {act.target || ''} · {formatWhen(act.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900 mb-4">
                <PlayIcon className="h-4 w-4 text-slate-400" />
                Quick actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/staff/tests" className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-black/5 hover:ring-black/15 transition-colors">
                  <p className="text-sm font-semibold text-navy-900">Tests</p>
                  <p className="text-xs text-slate-500">{stats?.totalTests ?? 0} total</p>
                </Link>
                <Link to="/staff/students" className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-black/5 hover:ring-black/15 transition-colors">
                  <p className="text-sm font-semibold text-navy-900">Students</p>
                  <p className="text-xs text-slate-500">{stats?.totalStudents ?? 0} registered</p>
                </Link>
                <Link to="/staff/results" className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-black/5 hover:ring-black/15 transition-colors">
                  <p className="text-sm font-semibold text-navy-900">Results</p>
                  <p className="text-xs text-slate-500">Review & export</p>
                </Link>
                <Link to="/staff/edit-requests" className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-black/5 hover:ring-black/15 transition-colors">
                  <p className="text-sm font-semibold text-navy-900">Requests</p>
                  <p className="text-xs text-slate-500">
                    {Number(stats?.editRequests ?? 0) > 0 ? `${stats.editRequests} pending` : 'None pending'}
                  </p>
                </Link>
              </div>
              <Link
                to="/staff/results"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-navy-700 ring-1 ring-inset ring-black/5 hover:ring-black/15 hover:bg-white transition-colors"
              >
                <FileBarChart2Icon className="h-4 w-4" />
                Export results
              </Link>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}