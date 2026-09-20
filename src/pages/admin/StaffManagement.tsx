import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRoundIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { TextField } from '../../components/TextField';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { adminNav } from './adminNav';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/format';

export function StaffManagement() {
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  // Auto-generate next staff ID — memoised so input focus isn't stolen on every keystroke
  const nextId = useMemo(() => {
    const nums = staff.map((s: any) => parseInt(String(s.id).replace(/\D/g, '')) || 0);
    const max = nums.length ? Math.max(...nums) : 2;
    return `STAFF${String(max + 1).padStart(3, '0')}`;
  }, [staff]);
  const handleClose = useCallback(() => setCreateOpen(false), []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.
    staffAccounts({ search }).
    then((res) => {
      setStaff(res.staff);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, [search]);

  useEffect(load, [load]);

  const update = async (id: string, payload: Record<string, unknown>, message: string) => {
    try {
      await api.updateStaff(id, payload);
      toast.success(message);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: Column<any>[] = [
  { key: 'id', header: 'Staff ID', render: (row) => <span className="font-mono text-xs">{row.id}</span> },
  { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-navy-800">{row.name}</span> },
  { key: 'email', header: 'Email', render: (row) => row.email || '—' },
  { key: 'created', header: 'Created', render: (row) => formatDateTime(row.createdAt) },
  {
    key: 'status',
    header: 'Status',
    render: (row) =>
    <StatusBadge status={row.active ? 'ACTIVE' : 'ARCHIVED'} label={row.active ? 'Active' : 'Inactive'} />

  },
  {
    key: 'actions',
    header: 'Actions',
    align: 'right',
    render: (row) =>
    <div className="flex items-center justify-end gap-1">
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
            <h1 className="text-2xl font-bold text-navy-800">Staff management</h1>
            <p className="mt-1 text-sm text-slate-600">
              Only a Super Admin can create staff accounts. Staff cannot create other accounts.
            </p>
          </div>
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Add staff
          </Button>
        </div>

        <Card>
          <div className="border-b border-slate-200 p-4">
            <div className="w-full sm:w-64 max-w-full">
              <TextField
                label="Search"
                placeholder="Staff ID or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<SearchIcon className="h-4 w-4" />} />
              
            </div>
          </div>
          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={load} /> :

          <DataTable
            columns={columns}
            rows={staff}
            rowKey={(row) => row.id}
            dense
            caption="Staff accounts"
            empty={<EmptyState title="No staff accounts found" />} />

          }
        </Card>
      </div>

      <Modal
        open={createOpen}
        onClose={handleClose}
        title="Add staff member"
        description="Only name is required — ID and password are auto-filled if left blank."
        footer={
        <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
            loading={saving}
            onClick={async () => {
              if (!form.name.trim()) { toast.error('Please enter the staff name'); return; }
              setSaving(true);
              try {
                const payload = {
                  id: (form.id.trim() || nextId).toUpperCase(),
                  name: form.name.trim(),
                  email: form.email.trim(),
                  password: form.password.trim() || 'staff@2026',
                };
                await api.createStaff(payload);
                toast.success(`${payload.id} created`);
                setCreateOpen(false);
                setForm({ id: '', name: '', email: '', password: '' });
                load();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}>

              Create staff
            </Button>
          </>
        }>

        <div className="space-y-4">
          <TextField
            label="Staff ID"
            placeholder={nextId}
            hint={`Leave blank to auto-generate: ${nextId}`}
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
          />
          <TextField
            label="Name *"
            placeholder="e.g., Dr. John Doe"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            placeholder="e.g., john@kare.edu (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            label="Password"
            type="password"
            placeholder="Leave blank for default: staff@2026"
            hint="If left blank, password will be staff@2026"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
      </Modal>
    </PortalLayout>);

}