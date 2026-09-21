import React, { useCallback, useEffect, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StaffNavFooter, staffNav } from './staffNav';
import { api } from '../../services/api';
import { formatDateTime, titleCase } from '../../utils/format';
import { useLive } from '../../hooks/useLive';

export function SecurityEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState({ type: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.securityEvents(filters);
      setEvents(res.events);
      setTypes(res.types);
      setError(null);
    } catch (err) {
      if (initial) {
        setError((err as Error).message);
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load(true);
  }, [load]);

  useLive({ intervalMs: 15000, onEvent: () => load(false), channel: 'staff-securityevents' });

  const columns: Column<any>[] = [
  { key: 'time', header: 'Time', render: (row) => formatDateTime(row.createdAt) },
  {
    key: 'type',
    header: 'Event',
    render: (row) => <span className="font-medium text-navy-800">{titleCase(row.type)}</span>
  },
  { key: 'actor', header: 'Actor', render: (row) => <span className="font-mono text-xs">{row.actor}</span> },
  { key: 'role', header: 'Role', render: (row) => titleCase(row.role) },
  { key: 'detail', header: 'Detail', render: (row) => row.detail }];


  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">Security</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Monitoring signals recorded by the platform. These are indicators for review — they do
            not by themselves prove misconduct.
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
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
            <div className="w-64">
              <SelectField
                label="Event type"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                options={[
                { value: '', label: 'All events' },
                ...types.map((t) => ({ value: t, label: titleCase(t) }))]
                } />
              
            </div>
            <div className="w-64">
              <TextField
                label="Search"
                placeholder="Actor or detail…"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                icon={<SearchIcon className="h-4 w-4" />} />
              
            </div>
          </div>

          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={() => load(true)} /> :

          <DataTable
            columns={columns}
            rows={events}
            rowKey={(row) => row.id}
            dense
            caption="Security events"
            empty={<EmptyState title="No security events recorded" />} />

          }
        </Card>
      </div>
    </PortalLayout>);

}