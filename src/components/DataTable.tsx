import React from 'react';
import { cn } from '../utils/cn';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
  dense?: boolean;
  caption?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  dense = false,
  caption
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="fc-scroll w-full overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) =>
            <th
              key={col.key}
              scope="col"
              style={col.width ? { width: col.width } : undefined}
              className={cn(
                'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center'
              )}>
              
                {col.header}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
          <tr key={rowKey(row)} className="border-b border-slate-100 last:border-0">
              {columns.map((col) =>
            <td
              key={col.key}
              className={cn(
                'px-4 text-sm text-slate-700',
                dense ? 'py-2' : 'py-3',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center'
              )}>
              
                  {col.render(row)}
                </td>
            )}
            </tr>
          )}
        </tbody>
      </table>
    </div>);

}