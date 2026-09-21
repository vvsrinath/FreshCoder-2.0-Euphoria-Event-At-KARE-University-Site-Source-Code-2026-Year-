import React from 'react';
import { GithubIcon, GlobeIcon, LinkedinIcon, MailIcon, PhoneIcon } from 'lucide-react';
import { brand, contact, team } from '../data/eventConfig';
import { cn } from '../utils/cn';

export function GlobalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'w-full border-t border-black/10 bg-white text-slate-500 py-10 px-5 sm:px-8',
        className
      )}
    >
      <div className="mx-auto flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl">
        {/* Left: University Crest & Name */}
        <div className="flex items-center gap-3">
          <img
            src="/kare-emblem.png"
            alt="Kalasalingam Emblem"
            className="h-10 w-10 shrink-0 object-contain drop-shadow-sm"
          />
          <div className="leading-tight">
            <p className="font-bold text-navy-900 tracking-wide text-[12px] uppercase">
              {brand.universityShort}
            </p>
            <p className="text-[9.5px] text-slate-500 font-semibold uppercase tracking-wider">
              {brand.universitySub}
            </p>
            <p className="text-[9px] font-bold text-slate-400">
              {brand.deemed}
            </p>
          </div>
        </div>

        {/* Center: Fresh Coders 2.0 + Technical Contacts */}
        <div className="text-center">
          <p className="font-bold text-navy-900 text-[13px] tracking-wide">
            FRESH CODERS 2.0 <span className="text-brand-500">|</span> Euphoria 2026
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Department of Freshman Engineering
          </p>
          <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2.5 ring-1 ring-inset ring-black/5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Technical Contacts</p>
            <div className="mt-1.5 flex flex-col gap-1.5 text-[11px]">
              <span className="flex flex-wrap items-center justify-center gap-2">
                <span className="font-bold text-navy-900">{team[0].name.split(' ').slice(0, 2).join(' ')}</span>
                <a href={`mailto:${team[0].email}`} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"><MailIcon className="h-3 w-3" />{team[0].email}</a>
                <a href={`https://github.com/${team[0].github}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-navy-900"><GithubIcon className="h-3 w-3" />{team[0].github}</a>
              </span>
              <span className="flex flex-wrap items-center justify-center gap-2">
                <span className="font-bold text-navy-900">{team[1].name}</span>
                <a href={`mailto:${team[1].email}`} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"><MailIcon className="h-3 w-3" />{team[1].email}</a>
                <a href={`tel:${team[1].phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-navy-900"><PhoneIcon className="h-3 w-3" />{team[1].phone}</a>
                <a href={team[1].linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-navy-900"><LinkedinIcon className="h-3 w-3" />LinkedIn</a>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Event desk & site */}
        <div className="flex flex-col md:items-end items-center text-[11px]">
          <p className="font-semibold text-slate-600 tracking-wider">Code • Compete • Conquer</p>
          <a
            href={`https://${contact.registrationSite}`}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-700 transition-colors"
          >
            <GlobeIcon className="h-3.5 w-3.5" />
            <span>{contact.registrationSite}</span>
          </a>
          <p className="mt-1 text-slate-500">{contact.email} · {contact.phone}</p>
        </div>
      </div>
    </footer>
  );
}
