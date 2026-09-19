import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Error 404</p>
        <h1 className="mt-2 text-xl font-bold text-navy-800">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you are looking for does not exist or you no longer have access to it.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/">
            <Button>Event home</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </div>
    </div>);

}