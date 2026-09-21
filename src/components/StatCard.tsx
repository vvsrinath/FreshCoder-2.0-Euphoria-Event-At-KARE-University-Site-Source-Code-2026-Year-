import React from 'react';
import { cn } from '../utils/cn';

export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  hint,
  emphasis = false
}: {label: string;value: React.ReactNode;icon?: React.ReactNode;tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';hint?: string;emphasis?: boolean;}) {
  const tones = {
    default: 'text-navy-900 dark:text-white',
    success: 'text-navy-900 dark:text-white',
    warning: 'text-navy-900 dark:text-white',
    danger: 'text-navy-900 dark:text-white',
    brand: 'text-brand-600 dark:text-brand-400'
  };
  return (
    <div
      className={cn(
        'rounded-2xl bg-white p-6 shadow-sm ring-1 dark:bg-white/[0.05] dark:shadow-none',
        emphasis ? 'ring-brand-200 dark:ring-brand-400/40' : 'ring-black/5 dark:ring-white/10'
      )}>
      
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', tones[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>);

}