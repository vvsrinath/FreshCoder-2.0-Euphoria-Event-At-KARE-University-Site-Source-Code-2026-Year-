import React, { useId } from 'react';
import { cn } from '../utils/cn';

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function TextField({ label, hint, error, icon, className, id, ...rest }: TextFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="w-full">
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold text-navy-700">
        {label}
      </label>
      <div className="relative">
        {icon ?
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span> :
        null}
        <input
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...rest}
          className={cn(
            'h-10 w-full rounded-md border bg-white px-3 text-sm text-navy-800 placeholder:text-slate-400',
            'transition-colors duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
            icon && 'pl-9',
            error ? 'border-red-400' : 'border-slate-300',
            className
          )} />
        
      </div>
      {error ?
      <p id={`${fieldId}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p> :
      hint ?
      <p className="mt-1 text-xs text-slate-500">{hint}</p> :
      null}
    </div>);

}