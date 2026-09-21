import React, { useCallback, useEffect, useState } from 'react';
import { SearchIcon, UsersIcon, RefreshCwIcon } from 'lucide-react';
import { PortalLayout } from '../../components/PortalLayout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { StaffNavFooter, staffNav } from './staffNav';
import { api } from '../../services/api';

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function StaffStudents() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .staffStudents({ search: search || undefined })
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const id = window.setTimeout(load, 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const students = data?.students ?? [];

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">Students</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Read-only roster. Account management lives in the admin portal.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by ID or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 max-w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCwIcon className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {loading && !data ? (
          <LoadingState label="Loading students…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {students.length === 0 ? (
              <EmptyState
                title="No students found"
                description={search ? 'No students match your search.' : 'No students have been registered yet.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">ID</th>
                      <th className="px-5 py-3.5">Name</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-center">Tests taken</th>
                      <th className="px-5 py-3.5">Current</th>
                      <th className="px-5 py-3.5">Last activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-mono font-bold text-navy-900">{s.id}</td>
                        <td className="px-5 py-4 font-medium text-slate-700">{s.name}</td>
                        <td className="px-5 py-4">
                          {s.currentStatus === 'NOT_STARTED' ? (
                            <StatusBadge status="NOT_STARTED" label="Not started" />
                          ) : (
                            <StatusBadge status={s.currentStatus} />
                          )}
                        </td>
                        <td className="px-5 py-4 text-center font-bold tabular-nums text-navy-800">{s.takenTests}</td>
                        <td className="px-5 py-4 text-slate-600">{s.currentTest ?? '—'}</td>
                        <td className="px-5 py-4 text-slate-500">{fmt(s.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {data ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <UsersIcon className="h-4 w-4" />
            {data.total} students · {data.activeCount} active
          </div>
        ) : null}
      </div>
    </PortalLayout>
  );
}