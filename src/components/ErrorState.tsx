import React from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry




}: {title?: string;message: string;onRetry?: () => void;}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircleIcon className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
      <p className="max-w-md text-sm text-slate-600">{message}</p>
      {onRetry ?
      <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button> :
      null}
    </div>);

}