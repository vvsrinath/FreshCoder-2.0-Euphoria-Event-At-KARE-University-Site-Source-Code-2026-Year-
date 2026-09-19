import React, { useEffect, useRef, useState } from 'react';
import { ClockIcon } from 'lucide-react';
import { formatClock } from '../utils/format';
import { cn } from '../utils/cn';

/**
 * Visual countdown only. The authoritative deadline lives on the server and
 * is re-checked on every heartbeat and at submission.
 */
export function ExamTimer({
  deadline,
  serverOffsetMs,
  onExpire




}: {deadline: string | null;serverOffsetMs: number;onExpire: () => void;}) {
  const [remaining, setRemaining] = useState(0);
  const fired = useRef(false);

  useEffect(() => {
    if (!deadline) return undefined;
    fired.current = false;
    const tick = () => {
      const target = new Date(deadline).getTime();
      const nowServer = Date.now() + serverOffsetMs;
      const seconds = Math.round((target - nowServer) / 1000);
      setRemaining(seconds);
      if (seconds <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline, serverOffsetMs, onExpire]);

  const critical = remaining <= 300;

  return (
    <div className="flex items-center gap-2">
      <ClockIcon className={cn('h-4 w-4', critical ? 'text-red-400' : 'text-slate-300')} aria-hidden="true" />
      <div className="leading-tight">
        <p
          className={cn(
            'font-mono text-xl font-semibold tabular-nums',
            critical ? 'text-red-400' : 'text-white'
          )}
          role="timer"
          aria-live="off">
          
          {formatClock(remaining)}
        </p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Time remaining</p>
      </div>
    </div>);

}