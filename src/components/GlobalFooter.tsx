import React from 'react';
import { GlobeIcon } from 'lucide-react';
import { brand, eventConfig } from '../data/eventConfig';
import { cn } from '../utils/cn';

export function GlobalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'w-full border-t border-slate-800 bg-[#070c1e] text-slate-300 py-4 px-5 sm:px-8',
        className
      )}
    >
      <div className="mx-auto flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl text-xs">
        {/* Left: University Crest & Name */}
        <div className="flex items-center gap-3">
          <img
            src="/kare-emblem.png"
            alt="Kalasalingam Emblem"
            className="h-10 w-10 shrink-0 object-contain drop-shadow-sm"
          />
          <div className="leading-tight">
            <p className="font-black text-white tracking-wide text-[12px] uppercase">
              {brand.universityShort}
            </p>
            <p className="text-[9.5px] text-slate-300 font-semibold uppercase tracking-wider">
              {brand.universitySub}
            </p>
            <p className="text-[9px] font-bold text-red-400">
              {brand.deemed}
            </p>
          </div>
        </div>

        {/* Center: Fresh Coders 2.0 & Euphoria */}
        <div className="text-center">
          <p className="font-bold text-white text-[13px] tracking-wide">
            FRESH CODERS 2.0 <span className="text-sky-400">|</span> Euphoria 2026
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Department of Freshman Engineering
          </p>
        </div>

        {/* Right: Tagline & Website */}
        <div className="flex flex-col md:items-end items-center text-[11px]">
          <p className="font-semibold text-slate-300 tracking-wider">
            Code • Compete • Conquer
          </p>
          <a
            href={`https://${eventConfig.registrationSite}`}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors"
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            <span>{eventConfig.registrationSite}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
