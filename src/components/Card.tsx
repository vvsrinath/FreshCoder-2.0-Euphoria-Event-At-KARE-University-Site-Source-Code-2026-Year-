import React from 'react';
import { cn } from '../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}

export function Card({ children, className, as: Tag = 'div' }: CardProps) {
  return (
    <Tag className={cn('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {children}
    </Tag>);

}

export function CardHeader({
  title,
  description,
  action,
  className





}: {title: React.ReactNode;description?: React.ReactNode;action?: React.ReactNode;className?: string;}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4',
        className
      )}>
      
      <div>
        <h2 className="text-base font-semibold text-navy-800">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>);

}