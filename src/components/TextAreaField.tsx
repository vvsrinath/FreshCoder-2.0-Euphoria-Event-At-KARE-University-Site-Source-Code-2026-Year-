import React, { useId } from 'react';
import { cn } from '../utils/cn';

interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

export function TextAreaField({
  label,
  hint,
  error,
  mono = false,
  className,
  id,
  ...rest
}: TextAreaFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="w-full">
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold text-navy-700">
        {label}
      </label>
      <textarea
        id={fieldId}
        {...rest}
        className={cn(
          'w-full rounded-md border bg-white px-3 py-2 text-sm text-navy-800 placeholder:text-slate-400',
          'transition-colors duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
          mono && 'font-mono text-[13px]',
          error ? 'border-red-400' : 'border-slate-300',
          className
        )} />
      
      {error ?
      <p className="mt-1 text-xs text-red-600">{error}</p> :
      hint ?
      <p className="mt-1 text-xs text-slate-500">{hint}</p> :
      null}
    </div>);

}