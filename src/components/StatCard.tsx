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
    default: 'text-navy-800',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    brand: 'text-brand-600'
  };
  return (
    <div
      className={cn(
        'rounded-lg border bg-white px-4 py-3 shadow-card',
        emphasis ? 'border-brand-200 ring-1 ring-brand-100' : 'border-slate-200'
      )}>
      
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', tones[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>);

}