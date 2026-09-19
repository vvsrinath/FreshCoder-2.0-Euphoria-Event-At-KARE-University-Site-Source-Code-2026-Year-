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
        className={cn('mb-1.5 block text-xs font-semibold text-navy-700', srLabel && 'sr-only')}>
        
          {label}
        </label> :
      null}
      <select
        id={fieldId}
        {...rest}
        className={cn(
          'h-10 w-full rounded-md border bg-white px-3 text-sm text-navy-800',
          'transition-colors duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
          error ? 'border-red-400' : 'border-slate-300',
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