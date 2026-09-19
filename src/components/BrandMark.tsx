import React from 'react';
import { cn } from '../utils/cn';

export function BrandMark({
  tone = 'dark',
  className,
  showCrest = true,
}: {
  tone?: 'dark' | 'light';
  className?: string;
  showCrest?: boolean;
}) {
  const light = tone === 'light';

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      {showCrest ? (
        <img
          src="/kare-emblem.png"
          alt="Kalasalingam Emblem"
          className="h-9 w-9 shrink-0 object-contain drop-shadow-sm"
        />
      ) : null}
      <div className="leading-tight">
        <span
          className={cn(
            'block text-sm font-black tracking-wider uppercase',
            light ? 'text-white' : 'text-navy-900'
          )}
        >
          FRESH <span className="text-sky-400">CODERS 2.0</span>
        </span>
        <span
          className={cn(
            'block text-[9px] font-semibold uppercase tracking-[0.2em]',
            light ? 'text-slate-400' : 'text-slate-500'
          )}
        >
          Euphoria 2026
        </span>
      </div>
    </div>
  );
}