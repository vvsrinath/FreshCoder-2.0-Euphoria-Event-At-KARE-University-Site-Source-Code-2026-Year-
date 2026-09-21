import React from 'react';

export function LoadingState({ label = 'Loading…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4 px-6 py-8">
      <div aria-hidden className="flex items-center gap-2 text-sm font-medium text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-black/40 dark:border-white/15 dark:border-t-white/60" />
        {label}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="flex animate-pulse items-center justify-between gap-4 rounded-xl bg-white p-3 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
        >
          <div className="space-y-2">
            <div className="h-3 w-40 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-24 rounded bg-black/10 dark:bg-white/10" />
          </div>
          <div className="h-8 w-20 rounded-lg bg-black/10 dark:bg-white/10" />
        </div>
      ))}
    </div>
  );
}