import React, { useCallback, useEffect, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { TextField } from '../../components/TextField';
import { TextAreaField } from '../../components/TextAreaField';
import { SelectField } from '../../components/SelectField';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { adminNav } from './adminNav';
import { api } from '../../services/api';

const emptyEvent = {
  name: '',
  description: '',
  department: 'Department of Freshman Engineering',
  startDate: '',
  endDate: '',
  venue: '',
  status: 'DRAFT',
  registrationSite: '',
  registrationFee: '',
  prizePool: ''
};

export function EventManagement() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyEvent });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.
    events().
    then((res) => {
      setEvents(res.events);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const columns: Column<any>[] = [
  { key: 'name', header: 'Event', render: (row) => <span className="font-medium text-navy-800">{row.name}</span> },
  { key: 'department', header: 'Department', render: (row) => row.department },
  { key: 'dates', header: 'Dates', render: (row) => `${row.startDate || '—'} → ${row.endDate || '—'}` },
  { key: 'venue', header: 'Venue', render: (row) => row.venue || '—' },
  { key: 'tests', header: 'Tests', render: (row) => row.testCount, align: 'center' },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> }];


  return (
    <PortalLayout portalLabel="Super Admin" navItems={adminNav}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Event management</h1>
            <p className="mt-1 text-sm text-slate-600">
              An event groups many tests. The platform is reusable for future competitions.
            </p>
          </div>
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Create event
          </Button>
        </div>

        <Card>
          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={load} /> :

          <DataTable
            columns={columns}
            rows={events}
            rowKey={(row) => row.id}
            caption="Events"
            empty={<EmptyState title="No events yet" />} />

          }
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Create event"
        footer={
        <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await api.createEvent(form);
                toast.success(`${form.name} created`);
                setOpen(false);
                setForm({ ...emptyEvent });
                load();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}>
            
              Create event
            </Button>
          </>
        }>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <div className="sm:col-span-2">
            <TextAreaField label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <TextField label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <TextField label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <TextField label="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'ARCHIVED', label: 'Archived' }]
            } />
          
          <TextField label="Registration site" value={form.registrationSite} onChange={(e) => setForm({ ...form, registrationSite: e.target.value })} />
          <TextField label="Registration fee" value={form.registrationFee} onChange={(e) => setForm({ ...form, registrationFee: e.target.value })} />
          <TextField label="Prize pool" value={form.prizePool} onChange={(e) => setForm({ ...form, prizePool: e.target.value })} />
        </div>
      </Modal>
    </PortalLayout>);

}