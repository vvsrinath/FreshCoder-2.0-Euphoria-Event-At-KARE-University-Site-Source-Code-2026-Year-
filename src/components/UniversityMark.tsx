import React from 'react';
import { cn } from '../utils/cn';

export function UniversityMark({
  tone = 'dark',
  className,
  size = 'md',
  showBanner = true,
}: {
  tone?: 'dark' | 'light';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showBanner?: boolean;
}) {
  const isLight = tone === 'light';

  if (showBanner) {
    return (
      <div className={cn('inline-flex items-center', className)}>
        <div
          className={cn(
            'flex items-center rounded-xl p-1.5 transition-all duration-150',
            isLight
              ? 'bg-white/95 backdrop-blur-md shadow-sm border border-white/20 hover:bg-white'
              : 'bg-transparent'
          )}
        >
          <img
            src="/kare-banner-text.png"
            alt="Kalasalingam Academy of Research and Education (Deemed to be University)"
            className={cn(
              'object-contain drop-shadow-2xs',
              size === 'sm' ? 'h-8 sm:h-9' : size === 'lg' ? 'h-13 sm:h-15' : 'h-10 sm:h-12'
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <img
        src="/kare-emblem.png"
        alt="Kalasalingam University Crest"
        className={cn(
          'object-contain shrink-0 drop-shadow-sm',
          size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
        )}
      />
      <div className="leading-tight">
        <span
          className={cn(
            'block font-black text-sm tracking-wide uppercase',
            isLight ? 'text-white' : 'text-[#005A9C]'
          )}
        >
          KALASALINGAM
        </span>
        <span
          className={cn(
            'block text-[9.5px] font-bold uppercase tracking-wider',
            isLight ? 'text-red-400' : 'text-[#D2232A]'
          )}
        >
          ACADEMY OF RESEARCH AND EDUCATION
        </span>
        <span className="mt-0.5 inline-block text-[8.5px] font-extrabold uppercase tracking-wide bg-[#005A9C] text-white px-1.5 py-0.5 rounded-full">
          (Deemed to be University)
        </span>
      </div>
    </div>
  );
}