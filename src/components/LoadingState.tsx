import React from 'react';

export function LoadingState({ label = 'Loading…' }: {label?: string;}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-slate-500">
      
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-black/10 border-t-black/40" />
      <span className="text-sm">{label}</span>
    </div>);

}