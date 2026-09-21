import React from 'react';
import { cn } from '../utils/cn';
import { titleCase } from '../utils/format';

const dots: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  IN_PROGRESS: 'bg-emerald-500',
  PUBLISHED: 'bg-emerald-500',
  APPROVED: 'bg-emerald-500',
  EASY: 'bg-emerald-500',
  SCHEDULED: 'bg-sky-500',
  SUBMITTED: 'bg-sky-500',
  PAUSED: 'bg-amber-500',
  PENDING: 'bg-amber-500',
  LOCKED: 'bg-amber-500',
  MEDIUM: 'bg-amber-500',
  DENIED: 'bg-red-500',
  DISCONNECTED: 'bg-red-500',
  FORCE_SUBMITTED: 'bg-orange-500',
  TIME_EXPIRED: 'bg-orange-500',
  HARD: 'bg-red-500'
};

export function StatusBadge({
  status,
  label,
  className
}: {status: string;label?: string;className?: string;}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-black/10 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/15',
        className
      )}>
      
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dots[status] ?? 'bg-slate-400')} />
      {label ?? titleCase(status)}
    </span>);

}