import React from 'react';
import { cn } from '../utils/cn';
import { titleCase } from '../utils/format';

const tones: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  SCHEDULED: 'bg-brand-50 text-brand-700 border-brand-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
  NOT_STARTED: 'bg-slate-100 text-slate-600 border-slate-200',
  IN_PROGRESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOCKED: 'bg-amber-50 text-amber-800 border-amber-200',
  SUBMITTED: 'bg-brand-50 text-brand-700 border-brand-200',
  FORCE_SUBMITTED: 'bg-orange-50 text-orange-700 border-orange-200',
  TIME_EXPIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  DISCONNECTED: 'bg-red-50 text-red-700 border-red-200',
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DENIED: 'bg-red-50 text-red-700 border-red-200',
  EASY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-800 border-amber-200',
  HARD: 'bg-red-50 text-red-700 border-red-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  HIDDEN: 'bg-slate-100 text-slate-600 border-slate-200'
};

export function StatusBadge({
  status,
  label,
  className




}: {status: string;label?: string;className?: string;}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold',
        tones[status] ?? 'bg-slate-100 text-slate-700 border-slate-200',
        className
      )}>
      
      {label ?? titleCase(status)}
    </span>);

}