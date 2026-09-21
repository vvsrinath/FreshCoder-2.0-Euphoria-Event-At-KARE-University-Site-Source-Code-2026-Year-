import React from 'react';
import { PortalLayout } from '../../components/PortalLayout';
import { studentNav } from './studentNav';
import { Card } from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { UserCheckIcon, MailIcon, BookOpenIcon, ShieldCheckIcon } from 'lucide-react';

export function StudentProfile() {
  const { user } = useAuth();

  return (
    <PortalLayout portalLabel="Student Portal" navItems={studentNav}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Student Profile</h1>
          <p className="text-sm text-slate-500">Official participant registration details</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-5 border-b border-slate-100 pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-md">
              {user?.name?.charAt(0) ?? 'A'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-navy-900">{user?.name || 'Participant'}</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <ShieldCheckIcon className="h-3.5 w-3.5" /> Verified
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1">ID: {user?.id || '—'}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase">Department</span>
              <p className="mt-1 text-sm font-bold text-navy-800">Freshman Engineering</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase">Batch</span>
              <p className="mt-1 text-sm font-bold text-navy-800">2026 - First Year</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase">Institution</span>
              <p className="mt-1 text-sm font-bold text-navy-800">Kalasalingam Academy of Research and Education</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase">Assigned Venue</span>
              <p className="mt-1 text-sm font-bold text-navy-800">11th Block, Room No. 11506 & 11507</p>
            </div>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}

export function StudentSupport() {
  return (
    <PortalLayout portalLabel="Student Portal" navItems={studentNav}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Examination Help & Support</h1>
          <p className="text-sm text-slate-500">Need assistance during the event? Contact the invigilation team.</p>
        </div>

        <Card className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
              <h3 className="font-bold text-blue-950 text-base">Desk Help & Staff Station</h3>
              <p className="text-xs text-slate-600 mt-2">
                Available at 11th Block 5th Floor Control Desk. Raise your hand in the lab for immediate invigilator assistance.
              </p>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-5">
              <h3 className="font-bold text-purple-950 text-base">Technical Coordinator</h3>
              <p className="text-xs text-slate-600 mt-2">
                Email: <span className="font-semibold text-blue-600">euphoria@klu.ac.in</span>
                <br />
                Phone: <span className="font-semibold text-slate-700">+91 4563 289 042</span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </PortalLayout>
  );
}
