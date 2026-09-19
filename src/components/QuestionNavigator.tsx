import React from 'react';
import { LockIcon, FlagIcon } from 'lucide-react';
import { cn } from '../utils/cn';

export type QuestionState = 'current' | 'answered' | 'locked' | 'flagged' | 'unanswered';

const legend: { state: QuestionState; label: string; dot: string; countColor: string }[] = [
  { state: 'answered', label: 'Answered', dot: 'bg-emerald-500', countColor: 'text-emerald-700' },
  { state: 'unanswered', label: 'Not Answered', dot: 'border-2 border-slate-400 bg-white', countColor: 'text-slate-600' },
  { state: 'locked', label: 'Locked', dot: 'bg-amber-500', countColor: 'text-amber-700' },
  { state: 'current', label: 'Current', dot: 'bg-blue-600', countColor: 'text-blue-700' },
  { state: 'flagged', label: 'Flagged', dot: 'bg-orange-500', countColor: 'text-orange-700' },
];

export function QuestionNavigator({
  states,
  counts,
  onSelect,
}: {
  states: QuestionState[];
  counts: Record<QuestionState, number>;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex h-full flex-col font-sans">
      {/* Legend Header */}
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Overview
        </h3>
        <ul className="space-y-2">
          {legend.map((item) => (
            <li key={item.state} className="flex items-center justify-between text-xs text-slate-700">
              <span className="flex items-center gap-2.5">
                <span className={cn('h-3 w-3 rounded-full shrink-0', item.dot)} aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </span>
              <span className={cn('font-bold tabular-nums', item.countColor)}>
                {counts[item.state] ?? 0}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 1-30 Number Palette Grid */}
      <div className="fc-scroll mt-4 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-5 gap-2" role="list" aria-label="Question navigator">
          {states.map((state, index) => {
            const num = index + 1;
            const isCurrent = state === 'current';
            const isAnswered = state === 'answered';
            const isLocked = state === 'locked';
            const isFlagged = state === 'flagged';

            return (
              <button
                key={index}
                type="button"
                role="listitem"
                onClick={() => onSelect(index)}
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={`Question ${num}, ${state}`}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold tabular-nums transition-all duration-150',
                  isCurrent
                    ? 'border-2 border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-200'
                    : isAnswered
                    ? 'bg-emerald-500 text-white shadow-xs hover:bg-emerald-600'
                    : isLocked
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : isFlagged
                    ? 'bg-orange-100 text-orange-900 border border-orange-300'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-400'
                )}
              >
                {num}
                {isLocked ? (
                  <LockIcon className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-600 bg-white rounded-full p-0.5 border border-amber-300" />
                ) : isFlagged ? (
                  <FlagIcon className="absolute -top-1 -right-1 h-3.5 w-3.5 text-orange-600 bg-white rounded-full p-0.5 border border-orange-300" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}