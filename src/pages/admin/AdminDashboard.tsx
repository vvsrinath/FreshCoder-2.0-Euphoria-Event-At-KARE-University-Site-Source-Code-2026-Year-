import React, { useCallback, useEffect, useState } from 'react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { adminNav } from './adminNav';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import { relativeTime, titleCase } from '../../utils/format';
import { eventConfig } from '../../data/eventConfig';

const POLL_INTERVAL_MS = 15000;

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.adminOverview();
      setData(res);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (initial) {
        setError((err as Error).message);
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  const { mode } = useLive({ intervalMs: POLL_INTERVAL_MS, onEvent: () => load(false), channel: 'admin-dashboard' });

  useEffect(() => {
    load(true);
  }, [load]);

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '...';

  return (
    <PortalLayout portalLabel="Super Admin" navItems={adminNav}>
      {loading ?
      <LoadingState /> :
      error ?
      <ErrorState message={error} onRetry={() => load(true)} /> :

      <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Administration</h1>
            <p className="mt-1 text-sm text-slate-600">
              {eventConfig.name} · {eventConfig.subtitle}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {mode === 'live' ? `Live · instant sync · updated ${lastUpdatedLabel}` : `Live · auto-refreshes every 15s · updated ${lastUpdatedLabel}`}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Students" value={data?.stats?.students ?? 0} emphasis hint={`${data?.stats?.activeStudents ?? 0} active`} />
            <StatCard label="Staff accounts" value={data?.stats?.staff ?? 0} />
            <StatCard label="Events" value={data?.stats?.events ?? 0} />
            <StatCard label="Tests" value={data?.stats?.tests ?? 0} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active questions" value={data?.stats?.questions ?? 0} tone="brand" />
            <StatCard label="Stored results" value={data?.stats?.results ?? 0} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Recent administrative actions" />
              {(data?.recentAudit?.length ?? 0) === 0 ?
            <EmptyState title="No actions recorded" /> :

            <ul className="divide-y divide-slate-100">
                  {(data?.recentAudit ?? []).map((entry: any) =>
              <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-800">
                          {entry.action} · {entry.target}
                        </p>
                        <p className="truncate text-xs text-slate-500">{entry.metadata}</p>
                      </div>
                      <p className="shrink-0 text-xs text-slate-400">{relativeTime(entry.createdAt)}</p>
                    </li>
              )}
                </ul>
            }
            </Card>

            <Card>
              <CardHeader title="Security signals" />
              {(data?.securityEvents?.length ?? 0) === 0 ?
            <EmptyState title="Nothing recorded yet" /> :

            <ul className="divide-y divide-slate-100">
                  {(data?.securityEvents ?? []).map((event: any) =>
              <li key={event.id} className="px-5 py-3">
                      <p className="text-sm font-medium text-navy-800">{titleCase(event.type)}</p>
                      <p className="text-xs text-slate-500">
                        {event.actor} · {relativeTime(event.createdAt)}
                      </p>
                    </li>
              )}
                </ul>
            }
            </Card>
          </div>
        </div>
      }
    </PortalLayout>);

}