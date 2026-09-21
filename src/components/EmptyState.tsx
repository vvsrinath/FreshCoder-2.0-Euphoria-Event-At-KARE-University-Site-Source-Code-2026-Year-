import React from 'react';
import { InboxIcon } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
  icon





}: {title: string;description?: string;action?: React.ReactNode;icon?: React.ReactNode;}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-slate-400">
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </span>
      <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
      {description ? <p className="max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>);

}