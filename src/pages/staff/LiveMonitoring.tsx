import React, { useCallback, useEffect, useState } from 'react';
import { LockIcon, RefreshCwIcon, SendIcon, UnlockIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatCard } from '../../components/StatCard';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { staffNav } from './staffNav';
import { api } from '../../services/api';
import { relativeTime } from '../../utils/format';

/** 8s refresh keeps the room readable without hammering the backend. */
const REFRESH_MS = 8000;

export function LiveMonitoring() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forceTarget, setForceTarget] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const load = useCallback(() => {
    api.
    live().
    then((res) => {
      setData(res);
      setError(null);
      setLastUpdated(Date.now());
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: Column<any>[] = [
  { key: 'id', header: 'Student ID', render: (row) => <span className="font-mono text-xs">{row.studentId}</span> },
  { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-navy-800">{row.name}</span> },
  { key: 'test', header: 'Test', render: (row) => row.testName },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'progress',
    header: 'Question',
    align: 'center',
    render: (row) => `${row.currentQuestion} / ${row.totalQuestions}`
  },
  { key: 'answered', header: 'Answered', render: (row) => row.answered, align: 'center' },
  { key: 'locked', header: 'Locked', render: (row) => row.locked, align: 'center' },
  { key: 'activity', header: 'Last activity', render: (row) => relativeTime(row.lastActivity) },
  {
    key: 'events',
    header: 'Events',
    align: 'center',
    render: (row) =>
    row.securityEvents > 0 ?
    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {row.securityEvents}
          </span> :

    <span className="text-slate-400">0</span>

  },
  {
    key: 'actions',
    header: 'Actions',
    align: 'right',
    render: (row) =>
    <div className="flex items-center justify-end gap-1">
          {row.status === 'LOCKED' ?
      <Button
        size="sm"
        variant="secondary"
        icon={<UnlockIcon className="h-3.5 w-3.5" />}
        onClick={() => run(() => api.unlockStudent(row.studentId, 'Cleared by staff'), `${row.studentId} unlocked`)}>
        
              Unlock
            </Button> :
      row.status === 'IN_PROGRESS' ?
      <Button
        size="sm"
        variant="secondary"
        icon={<LockIcon className="h-3.5 w-3.5" />}
        onClick={() => run(() => api.lockStudent(row.studentId, 'Locked by examination staff'), `${row.studentId} locked`)}>
        
              Lock
            </Button> :
      null}
          {['IN_PROGRESS', 'LOCKED'].includes(row.status) ?
      <Button
        size="sm"
        variant="danger"
        icon={<SendIcon className="h-3.5 w-3.5" />}
        onClick={() => setForceTarget(row)}>
        
              Force submit
            </Button> :
      null}
        </div>

  }];


  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-navy-800">Live monitoring</h1>
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-emerald-700">LIVE</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {lastUpdated ? `Updated ${relativeTime(new Date(lastUpdated).toISOString())} • every ${REFRESH_MS / 1000}s` : `Refreshes every ${REFRESH_MS / 1000}s from the examination server.`}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCwIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />} onClick={load} loading={loading && !!data}>
            Refresh now
          </Button>
        </div>

        {loading ?
        <Card>
            <LoadingState />
          </Card> :
        error ?
        <Card>
            <ErrorState message={error} onRetry={load} />
          </Card> :

        <>
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Total students" value={data.stats.total} />
              <StatCard label="Active" value={data.stats.active} tone="success" emphasis />
              <StatCard label="Submitted" value={data.stats.submitted} tone="brand" />
              <StatCard label="Locked" value={data.stats.locked} tone="warning" />
              <StatCard label="Disconnected" value={data.stats.disconnected} tone="danger" />
              <StatCard label="Security events" value={data.stats.securityEvents} />
            </div>

            <Card>
              <DataTable
              columns={columns}
              rows={data.rows}
              rowKey={(row) => row.attemptId}
              dense
              caption="Live attempts"
              empty={
              <EmptyState
                title="No live attempts"
                description="Attempts appear here as soon as students start a test." />

              } />
            
            </Card>
          </>
        }
      </div>

      <ConfirmDialog
        open={Boolean(forceTarget)}
        destructive
        loading={busy}
        title="Force submit this student?"
        confirmLabel="Force submit"
        message={
        <>
            The attempt for <strong>{forceTarget?.name}</strong> ({forceTarget?.studentId}) will be
            finalised with the answers currently stored on the server.
          </>
        }
        onCancel={() => setForceTarget(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api.forceSubmitStudent(forceTarget.studentId);
            toast.success(`${forceTarget.studentId} force submitted`);
            setForceTarget(null);
            load();
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }} />
      
    </PortalLayout>);

}