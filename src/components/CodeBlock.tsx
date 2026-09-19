import React from 'react';
import { cn } from '../utils/cn';

export function CodeBlock({ code, className }: {code: string;className?: string;}) {
  return (
    <pre
      className={cn(
        'fc-scroll overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-4 py-3',
        'font-mono text-[13px] leading-6 text-navy-800',
        className
      )}>
      
      <code>{code}</code>
    </pre>);

}