import React, { useEffect, useState } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon, UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { StaffNavFooter, staffNav } from './staffNav';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

export function StaffProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.me().catch(() => undefined);
  }, []);

  const mismatch = next !== confirm && confirm.length > 0;
  const weak = next.length > 0 && next.length < 8;

  const save = async () => {
    if (weak) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (mismatch) {
      toast.error('Confirmation does not match the new password.');
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      toast.success('Password changed. Please sign in again with the new password.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeftIcon className="h-4 w-4" />}
            onClick={() => navigate('/staff')}
          >
            Back
          </Button>
          <h1 className="text-2xl font-black text-navy-900 tracking-tight">Profile</h1>
        </div>

        <Card>
          <CardHeader
            title="Account"
            description="Your staff account details are managed by administration."
          />
          <div className="p-5">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white font-semibold text-sm shadow-sm">
                {user?.name?.charAt(0) || <UserIcon className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-bold text-navy-900">{user?.name ?? 'Staff'}</p>
                <p className="text-xs font-medium text-slate-500">{user?.id} · {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Staff'}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Change password"
            description="For your security, use a unique password with at least 8 characters."
          />
          <div className="space-y-4 p-5">
            <TextField
              label="Current password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
            <TextField
              label="New password"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              error={weak ? 'Must be at least 8 characters.' : undefined}
              autoComplete="new-password"
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={mismatch ? 'Passwords do not match.' : undefined}
              autoComplete="new-password"
            />
            <div className="flex items-center justify-end">
              <Button
                loading={saving}
                disabled={!current || !next || !confirm || weak || mismatch}
                onClick={save}
                icon={<ShieldCheckIcon className="h-4 w-4" />}
              >
                Update password
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}