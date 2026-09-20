import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRoundIcon, PlusIcon, SearchIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { TextField } from '../../components/TextField';
import { SelectField } from '../../components/SelectField';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { adminNav } from './adminNav';
import { api } from '../../services/api';
import { parseCsv } from '../../utils/csv';
import { formatDateTime } from '../../utils/format';

interface ImportReport {
  total: number;
  success: number;
  failed: number;
  errors: {row: number;message: string;}[];
}

export function StudentManagement() {
  const [students, setStudents] = useState<any[]>([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ id: '', name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.
    students(filters).
    then((res) => {
      setStudents(res.students);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load]);

  const create = async () => {
    if (!form.id.trim() || !form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      await api.createStudent({ id: form.id.trim(), name: form.name.trim(), email: form.email.trim(), password: form.password.trim() });
      toast.success(`${form.id.toUpperCase()} created`);
      setCreateOpen(false);
      setForm({ id: '', name: '', email: '', password: '' });
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: string, payload: Record<string, unknown>, message: string) => {
    try {
      await api.updateStudent(id, payload);
      toast.success(message);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error('No data rows found. Expected header: student_id,name,email,password');
      return;
    }
    try {
      const res = await api.importStudents(rows);
      setReport(res);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const columns: Column<any>[] = [
  { key: 'id', header: 'Student ID', render: (row) => <span className="font-mono text-xs">{row.id}</span> },
  { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-navy-800">{row.name}</span> },
  { key: 'email', header: 'Email', render: (row) => row.email || '—' },
  { key: 'created', header: 'Created', render: (row) => formatDateTime(row.createdAt) },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.active ? 'ACTIVE' : 'ARCHIVED'} label={row.active ? 'Active' : 'Inactive'} />
  },
  {
    key: 'actions',
    header: 'Actions',
    align: 'right',
    render: (row) =>
    <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
            Edit
          </Button>
          <Button
        size="sm"
        variant="secondary"
        onClick={() => update(row.id, { active: !row.active }, row.active ? `${row.id} deactivated` : `${row.id} activated`)}>
        
            {row.active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
        size="sm"
        variant="ghost"
        aria-label={`Reset password for ${row.id}`}
        icon={<KeyRoundIcon className="h-3.5 w-3.5" />}
        onClick={() => {
          const next = window.prompt(`New password for ${row.id}`);
          if (next) update(row.id, { password: next }, 'Password reset');
        }} />
      
        </div>

  }];


  return (
    <PortalLayout portalLabel="Super Admin" navItems={adminNav}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Student management</h1>
            <p className="mt-1 text-sm text-slate-600">
              Accounts are provisioned here — students cannot sign up.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
              aria-label="Upload student CSV" />
            
            <Button variant="secondary" icon={<UploadIcon className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              Import CSV
            </Button>
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Add student
            </Button>
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
            <div className="w-full sm:w-64 max-w-full">
              <TextField
                label="Search"
                placeholder="Student ID or name…"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                icon={<SearchIcon className="h-4 w-4" />} />
              
            </div>
            <div className="w-full sm:w-44 max-w-full">
              <SelectField
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                options={[
                { value: '', label: 'All' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' }]
                } />
              
            </div>
            <p className="ml-auto text-xs text-slate-500">
              CSV header: <code className="font-mono">student_id,name,email,password</code>
            </p>
          </div>

          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={load} /> :

          <DataTable
            columns={columns}
            rows={students}
            rowKey={(row) => row.id}
            dense
            caption="Students"
            empty={<EmptyState title="No students found" />} />

          }
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add student"
        footer={
        <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={create}>
              Create student
            </Button>
          </>
        }>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Student ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField
            label="Temporary password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="Stored as a hash. Never in plaintext." />
          
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.id ?? ''}`}
        footer={
        <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
            onClick={async () => {
              if (!editing.name?.trim() || !(editing.email ?? '').trim()) {
                toast.error('Name and email are required');
                return;
              }
              await update(editing.id, { name: editing.name.trim(), email: (editing.email ?? '').trim() }, 'Student updated');
              setEditing(null);
            }}>
            
              Save changes
            </Button>
          </>
        }>
        
        {editing ?
        <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <TextField label="Email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          </div> :
        null}
      </Modal>

      <Modal
        open={Boolean(report)}
        onClose={() => setReport(null)}
        title="CSV import report"
        footer={<Button onClick={() => setReport(null)}>Done</Button>}>
        
        {report ?
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200">
              {[
            ['Total records', report.total],
            ['Successful', report.success],
            ['Failed', report.failed]].
            map(([label, value]) =>
            <div key={label as string} className="bg-white px-4 py-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-navy-800">{value}</p>
                </div>
            )}
            </div>
            {report.errors.length > 0 ?
          <ul className="space-y-1 text-sm text-red-700">
                {report.errors.map((e) =>
            <li key={`${e.row}-${e.message}`}>
                    Row {e.row}: {e.message}
                  </li>
            )}
              </ul> :

          <p className="text-sm text-emerald-700">All records imported successfully.</p>
          }
          </div> :
        null}
      </Modal>
    </PortalLayout>);

}