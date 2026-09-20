import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, MenuIcon, PhoneIcon, XIcon } from 'lucide-react';
import { UniversityMark } from '../components/UniversityMark';
import { GlobalFooter } from '../components/GlobalFooter';
import { brand, contact, convenors, staffCoordinators, studentCoordinators } from '../data/eventConfig';

const AVATAR_TINTS = [
  'from-indigo-500 to-sky-500',
  'from-fuchsia-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-violet-500',
];

function initials(name: string) {
  return name
    .replace(/^Dr\.\s*/i, '')
    .replace(/^Ms\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function Convenors() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* ---------- Navigation ---------- */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <Link to="/" className="shrink-0" aria-label="Kalasalingam home">
            <UniversityMark tone="light" />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
            <Link to="/" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Home
            </Link>
            <Link to="/developers" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Developers
            </Link>
            <Link to="/convenors" className="text-sm font-semibold text-indigo-600">
              Convenors
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login?portal=STUDENT"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-700"
            >
              Student Portal
            </Link>
            <Link
              to="/login?portal=STAFF"
              className="hidden sm:inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              Staff Portal
            </Link>
            <button type="button" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden">
              {mobileOpen ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <>
            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden" />
            <nav className="absolute inset-x-0 top-16 z-40 border-b border-slate-200 bg-white px-5 py-4 shadow-lg lg:hidden">
              <div className="flex flex-col gap-1">
                <Link to="/" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Home</Link>
                <Link to="/developers" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Developers</Link>
                <Link to="/convenors" onClick={() => setMobileOpen(false)} className="rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700">Convenors</Link>
                <Link to="/login?portal=STAFF" onClick={() => setMobileOpen(false)} className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 sm:hidden">Staff Portal</Link>
              </div>
            </nav>
          </>
        )}
      </header>

      {/* ---------- Page header ---------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(38% 50% at 88% 6%, rgba(14,165,233,0.20), transparent 70%),' +
                'radial-gradient(42% 55% at 12% 12%, rgba(245,158,11,0.16), transparent 70%),' +
                'radial-gradient(50% 55% at 72% 92%, rgba(16,185,129,0.14), transparent 70%)',
            }}
          />
        </div>
        <div className="mx-auto max-w-7xl px-5 py-16 text-center lg:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Convenors & Coordinators
            <span className="block bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
              running the event
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            The faculty behind {brand.competition} — reach out to them for registration, event
            rules or official queries.
          </p>
        </div>
      </section>

      {/* ---------- Convenor cards ---------- */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {convenors.map((person, index) => (
              <article
                key={person.name}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-black text-white shadow-sm ${AVATAR_TINTS[index % AVATAR_TINTS.length]}`}
                  >
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-black tracking-tight text-slate-900">
                      {person.name}
                    </h2>
                    <p className="mt-0.5 text-xs font-semibold text-indigo-600">{person.role}</p>
                    {(person as unknown as { highlight?: string }).highlight && (
                      <span className="mt-1 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                        {(person as unknown as { highlight: string }).highlight === 'faculty-mentor' ? 'Developer Mentor' : 'Full Stack Developer'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {"email" in person && (person as unknown as { email: string }).email && (
                    <a href={`mailto:${(person as unknown as { email: string }).email}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                      {(person as unknown as { email: string }).email}
                    </a>
                  )}
                  {"phone" in person && (person as unknown as { phone: string }).phone && (
                    <a
                      href={`tel:${(person as unknown as { phone: string }).phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      <PhoneIcon className="h-3.5 w-3.5" /> {(person as unknown as { phone: string }).phone}
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Staff Coordinators */}
          <div className="mt-12">
            <h2 className="text-xl font-black tracking-tight text-slate-900">Staff Coordinators</h2>
            <p className="mt-1 text-sm text-slate-600">Faculty team coordinating the event.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {staffCoordinators.map((person, index) => (
                <article key={person.name} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-4">
                    <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-black text-white shadow-sm ${AVATAR_TINTS[index % AVATAR_TINTS.length]}`}>
                      {initials(person.name)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black tracking-tight text-slate-900">{person.name}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-indigo-600">{person.role}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {"phone" in person && (person as unknown as { phone: string }).phone && (
                      <a href={`tel:${(person as unknown as { phone: string }).phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        <PhoneIcon className="h-3.5 w-3.5" /> {(person as unknown as { phone: string }).phone}
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Student Coordinators */}
          <div className="mt-10">
            <h2 className="text-xl font-black tracking-tight text-slate-900">Student Coordinators</h2>
            <p className="mt-1 text-sm text-slate-600">Student team supporting the event.</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {studentCoordinators.map((person, index) => (
                <article key={person.name} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-4">
                    <span className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-black text-white shadow-sm ${AVATAR_TINTS[(index + 2) % AVATAR_TINTS.length]}`}>
                      {initials(person.name)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black tracking-tight text-slate-900">{person.name}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-600">{person.role}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {"phone" in person && (person as unknown as { phone: string }).phone && (
                      <a href={`tel:${(person as unknown as { phone: string }).phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                        <PhoneIcon className="h-3.5 w-3.5" /> {(person as unknown as { phone: string }).phone}
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Event desk */}
          <div className="mt-10 flex flex-col items-center justify-between gap-6 rounded-3xl bg-slate-900 p-8 text-white md:flex-row">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Event desk</p>
              <p className="mt-2 text-sm font-semibold">{contact.email} · {contact.phone}</p>
              <p className="mt-1 text-sm text-slate-300">{contact.office}</p>
            </div>
            <div className="text-center md:text-right">
              <a
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                href={`https://${contact.registrationSite}`}
                target="_blank"
                rel="noreferrer"
              >
                Register at {contact.registrationSite}
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}