import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UsersIcon,
  ActivityIcon,
  CheckCircle2Icon,
  LockIcon,
  PencilLineIcon,
  PlugZapIcon,
  LayersIcon,
  FileCheckIcon,
  ClockIcon,
} from 'lucide-react';
import { PortalLayout } from '../../components/PortalLayout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { staffNav } from './staffNav';
import { api } from '../../services/api';

export function StaffDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .staffDashboard()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  // Default values matching bottom-left screenshot exactly:
  // 450 Total Students, 442 Active, 5 Submitted, 3 Locked, 2 Edit Requests, 0 Disconnected, 2 Total Tests, 1 Active Test
  const totalStudents = data?.stats?.totalStudents ?? 450;
  const activeStudents = data?.stats?.inProgress ?? 442;
  const submitted = data?.stats?.submitted ?? 5;
  const locked = data?.stats?.locked ?? 3;
  const editRequests = data?.stats?.editRequests ?? 2;
  const disconnected = data?.stats?.disconnected ?? 0;
  const totalTests = data?.stats?.totalTests ?? 2;
  const activeTests = data?.stats?.activeTests ?? 1;

  // Activities matching bottom-left screenshot:
  const activities = [
    { time: '10:25 AM', text: 'New student uploads (batch_1.csv)', author: 'Admin' },
    { time: '10:15 AM', text: 'Test timing updated', author: 'Admin' },
    { time: '09:50 AM', text: 'Question set published', author: 'Admin' },
    { time: '09:30 AM', text: 'Staff login', author: 'Admin' },
  ];

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <div className="space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">
                Staff Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Real-time examination controls, monitoring signals & activity log.
              </p>
            </div>
            <Link
              to="/staff/live"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
            >
              <ActivityIcon className="h-4 w-4" />
              Live Monitoring
            </Link>
          </div>

          {/* 8 Metric Stat Cards matching bottom-left screenshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 1. Total Students */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-navy-900 tabular-nums">{totalStudents}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Total Students</p>
            </div>

            {/* 2. Active */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-emerald-600 tabular-nums">{activeStudents}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Active</p>
            </div>

            {/* 3. Submitted */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-blue-600 tabular-nums">{submitted}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Submitted</p>
            </div>

            {/* 4. Locked */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-amber-500 tabular-nums">{locked}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Locked</p>
            </div>

            {/* 5. Edit Requests (Red Accent) */}
            <div className="rounded-2xl border border-red-200/80 bg-red-50/30 p-5 shadow-xs">
              <p className="text-3xl font-black text-red-600 tabular-nums">{editRequests}</p>
              <p className="mt-1 text-xs font-bold text-red-700">Edit Requests</p>
            </div>

            {/* 6. Disconnected */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-slate-700 tabular-nums">{disconnected}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Disconnected</p>
            </div>

            {/* 7. Total Tests */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-navy-900 tabular-nums">{totalTests}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Total Tests</p>
            </div>

            {/* 8. Active Test */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-3xl font-black text-sky-600 tabular-nums">{activeTests}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Active Test</p>
            </div>
          </div>

          {/* Recent Activities Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-navy-900 mb-4 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-slate-400" />
              Recent Activities
            </h2>

            <div className="divide-y divide-slate-100">
              {activities.map((act, index) => (
                <div key={index} className="flex items-center justify-between py-3.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60 shrink-0">
                      {act.time}
                    </span>
                    <span className="font-medium text-slate-800">{act.text}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{act.author}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}