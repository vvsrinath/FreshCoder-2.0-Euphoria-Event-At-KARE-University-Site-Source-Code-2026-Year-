import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState } from './LoadingState';
import type { Role } from '../types';

/**
 * Convenience routing guard only. Authorization is enforced by the backend
 * on every protected endpoint — this just avoids rendering dead screens.
 */
export function ProtectedRoute({
  roles,
  children



}: {roles: Role[];children: React.ReactNode;}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-card">
          <h1 className="text-lg font-semibold text-navy-800">Access denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            You do not have permission to view this page. Sign in with an authorized account.
          </p>
        </div>
      </div>);

  }
  return <>{children}</>;
}