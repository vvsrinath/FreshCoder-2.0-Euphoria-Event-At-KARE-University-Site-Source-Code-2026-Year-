import React, { useState } from 'react';
import {
  ActivityIcon,
  ClipboardListIcon,
  FileBarChart2Icon,
  LayoutDashboardIcon,
  LogOutIcon,
  PencilLineIcon,
  ShieldAlertIcon,
  UsersIcon,
  UserIcon } from
'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NavItem } from '../../components/PortalLayout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

export const staffNav: NavItem[] = [
  { to: '/staff', label: 'Dashboard', icon: <LayoutDashboardIcon className="h-4 w-4" /> },
  { to: '/staff/tests', label: 'Tests', icon: <ClipboardListIcon className="h-4 w-4" /> },
  { to: '/staff/students', label: 'Students', icon: <UsersIcon className="h-4 w-4" /> },
  { to: '/staff/results', label: 'Results', icon: <FileBarChart2Icon className="h-4 w-4" /> },
  { to: '/staff/edit-requests', label: 'Requests', icon: <PencilLineIcon className="h-4 w-4" /> },
  { to: '/staff/security', label: 'Security', icon: <ShieldAlertIcon className="h-4 w-4" /> }];

export function StaffNavFooter() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  return (
    <>
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => navigate('/staff/profile')}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 transition-all hover:bg-white/10 hover:text-white"
        >
          <UserIcon className="h-4 w-4" />
          Profile
        </button>
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-white/10 hover:text-red-300"
        >
          <LogOutIcon className="h-4 w-4" />
          Logout
        </button>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You will need your ID and password to sign back in."
        confirmLabel="Sign out"
        destructive
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </>
  );
}