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
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
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
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  COMPLETED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ARCHIVED: 'bg-red-50 text-red-600 border-red-200',
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

  useEffect(() => {
    api.tests().then((res) => setTests(res.tests)).catch(() => undefined);
    load();
    const id = window.setInterval(() => {
      api.tests().then((res) => setTests(res.tests)).catch(() => undefined);
      load();
    }, 15000);
    return () => window.clearInterval(id);
  }, [load]);

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
              <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">
                Welcome, {user?.name?.split(' ')[0] || 'Staff'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Live examination controls and activity across Fresh Coders 2.0 – Euphoria 2026.
              </p>
            </div>
            <Link
              to="/staff/tests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
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
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Live test</p>
                    <h2 className="text-lg font-black text-navy-900">{running.name}</h2>
                  </div>
                </div>
                <Link
                  to={`/staff/tests/${running.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
                >
                  <ActivityIcon className="h-4 w-4" />
                  Monitor live
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-black text-navy-900 tabular-nums">{live?.stats?.active ?? 0}</p>
                  <p className="text-xs font-semibold text-slate-500">Writing now</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600 tabular-nums">{live?.stats?.submitted ?? 0}</p>
                  <p className="text-xs font-semibold text-slate-500">Submitted</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-amber-500 tabular-nums">{live?.stats?.locked ?? 0}</p>
                  <p className="text-xs font-semibold text-slate-500">Locked</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-red-600 tabular-nums">{live?.stats?.securityEvents ?? 0}</p>
                  <p className="text-xs font-semibold text-slate-500">Security flags</p>
                </div>
              </div>
            </div>
          ) : upcoming.length > 0 ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <ClockIcon className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-black text-navy-900">Upcoming tests</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {upcoming.map((t) => (
                  <Link
                    key={t.id}
                    to={`/staff/tests/${t.id}`}
                    className="rounded-xl border border-blue-100 bg-white p-4 hover:border-blue-300 transition-colors"
                  >
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[t.status]}`}>
                      {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                    </span>
                    <p className="mt-2 truncate text-sm font-bold text-navy-900">{t.name}</p>
                    <p className="text-xs text-slate-500">Starts {formatWhen(t.scheduledStart)}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy-900 mb-4">
                <ClockIcon className="h-4 w-4 text-slate-400" />
                Recent activity
              </h2>
              <div className="divide-y divide-slate-100">
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

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-navy-900 mb-4">
                <PlayIcon className="h-4 w-4 text-slate-400" />
                Quick actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/staff/tests" className="rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                  <p className="text-sm font-bold text-navy-900">Tests</p>
                  <p className="text-xs text-slate-500">{stats?.totalTests ?? 0} total</p>
                </Link>
                <Link to="/staff/students" className="rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                  <p className="text-sm font-bold text-navy-900">Students</p>
                  <p className="text-xs text-slate-500">{stats?.totalStudents ?? 0} registered</p>
                </Link>
                <Link to="/staff/results" className="rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                  <p className="text-sm font-bold text-navy-900">Results</p>
                  <p className="text-xs text-slate-500">Review & export</p>
                </Link>
                <Link to="/staff/edit-requests" className="rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                  <p className="text-sm font-bold text-navy-900">Requests</p>
                  <p className="text-xs text-slate-500">
                    {Number(stats?.editRequests ?? 0) > 0 ? `${stats.editRequests} pending` : 'None pending'}
                  </p>
                </Link>
              </div>
              <Link
                to="/staff/results"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
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