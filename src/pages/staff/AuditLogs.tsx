import React, { useCallback, useEffect, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { TextField } from '../../components/TextField';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { staffNav } from './staffNav';
import { api } from '../../services/api';
import { formatDateTime, titleCase } from '../../utils/format';

export function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.auditLogs({ search });
      setLogs(res.logs);
      setError(null);
    } catch (err) {
      if (initial) {
        setError((err as Error).message);
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load(true);
    const id = window.setInterval(() => {
      load(false);
    }, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const columns: Column<any>[] = [
  { key: 'time', header: 'Time', render: (row) => formatDateTime(row.createdAt) },
  { key: 'actor', header: 'Actor', render: (row) => <span className="font-mono text-xs">{row.actor}</span> },
  { key: 'role', header: 'Role', render: (row) => titleCase(row.role) },
  {
    key: 'action',
    header: 'Action',
    render: (row) => <span className="font-medium text-navy-800">{row.action}</span>
  },
  { key: 'target', header: 'Target', render: (row) => row.target },
  { key: 'metadata', header: 'Details', render: (row) => row.metadata || '—' }];


  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Audit logs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every administrative action is traceable to an actor, target and timestamp.
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · auto-refreshes every 15s
          </span>
        </div>

        <Card>
          <div className="border-b border-slate-200 p-4">
            <div className="w-full sm:w-72 max-w-full">
              <TextField
                label="Search"
                placeholder="Actor, action or target…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<SearchIcon className="h-4 w-4" />} />
              
            </div>
          </div>
          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={() => load(true)} /> :

          <DataTable
            columns={columns}
            rows={logs}
            rowKey={(row) => row.id}
            dense
            caption="Audit logs"
            empty={<EmptyState title="No audit entries" />} />

          }
        </Card>
      </div>
    </PortalLayout>);

}