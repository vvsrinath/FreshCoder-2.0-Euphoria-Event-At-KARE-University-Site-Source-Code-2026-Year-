import React, { useId } from 'react';
import { cn } from '../utils/cn';

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  hint?: string;
  error?: string;
  srLabel?: boolean;
}

export function SelectField({
  label,
  options,
  hint,
  error,
  srLabel = false,
  className,
  id,
  ...rest
}: SelectFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="w-full">
      {label ?
      <label
        htmlFor={fieldId}
        className={cn('mb-1.5 block text-xs font-medium text-navy-700 dark:text-slate-300', srLabel && 'sr-only')}>
        
          {label}
        </label> :
      null}
      <select
        id={fieldId}
        {...rest}
        className={cn(
          'h-10 w-full rounded-lg border bg-white px-3 text-sm text-navy-900 dark:bg-navy-900 dark:text-white',
          'transition-colors duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25',
          error ? 'border-red-400' : 'border-black/10 dark:border-white/15',
          className
        )}>
        
        {options.map((option) =>
        <option key={option.value} value={option.value}>
            {option.label}
          </option>
        )}
      </select>
      {error ?
      <p className="mt-1 text-xs text-red-600">{error}</p> :
      hint ?
      <p className="mt-1 text-xs text-slate-500">{hint}</p> :
      null}
    </div>);

}