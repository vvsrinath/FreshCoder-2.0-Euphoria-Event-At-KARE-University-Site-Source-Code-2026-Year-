import React, { useCallback, useEffect, useState } from 'react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { StatCard } from '../../components/StatCard';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { adminNav } from './adminNav';
import { api } from '../../services/api';
import { useLive } from '../../hooks/useLive';
import { relativeTime, titleCase } from '../../utils/format';
import { eventConfig } from '../../data/eventConfig';
import { Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 15000;

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [adminTests, setAdminTests] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTests = useCallback(() => {
    api.
    adminTests().
    then((res) => setAdminTests(res.tests ?? [])).
    catch(() => undefined).
    finally(() => setTestsLoading(false));
  }, []);

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.adminDeleteTest(deleteTarget.id);
      toast.success(`Test "${deleteTarget.name}" deleted — all its attempts and results removed.`);
      setDeleteTarget(null);
      loadTests();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

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

  useEffect(() => {
    loadTests();
  }, [loadTests]);

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
              <CardHeader title="Test data cleanup" description="Delete an old test together with all its attempts, answers and results. Live tests must be ended first." />
              {testsLoading ?
            <div className="p-5 text-sm text-slate-500">Loading tests…</div> :

            adminTests.length === 0 ?
            <EmptyState title="No tests to delete" /> :

            <ul className="divide-y divide-slate-100">
                  {adminTests.map((t: any) =>
                <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-navy-800">
                            {t.name}
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[10px] font-bold text-slate-500">{t.status}</span>
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {t.id} · {t.questionCount} questions · {t.assignedStudents} assigned
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={['ACTIVE', 'PAUSED'].includes(t.status)}
                          onClick={() => setDeleteTarget(t)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-xs hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </li>
                )}
              </ul>
            }
            </Card>

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
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name ?? 'test'}?`}
        message={`This permanently removes the test and every attempt, answer and result for it — this cannot be undone.`}
        confirmLabel="Delete permanently"
        destructive
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PortalLayout>);

}