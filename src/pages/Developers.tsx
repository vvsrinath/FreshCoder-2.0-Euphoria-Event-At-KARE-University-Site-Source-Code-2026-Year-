import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  GithubIcon,
  LinkedinIcon,
  MailIcon,
  MenuIcon,
  PhoneIcon,
  XIcon,
} from 'lucide-react';
import { UniversityMark } from '../components/UniversityMark';
import { GlobalFooter } from '../components/GlobalFooter';
import { brand, contact, team } from '../data/eventConfig';

export function Developers() {
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
            <Link to="/developers" className="text-sm font-semibold text-indigo-600">
              Developers
            </Link>
            <Link to="/convenors" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
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
                <Link to="/developers" onClick={() => setMobileOpen(false)} className="rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700">Developers</Link>
                <Link to="/convenors" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Convenors</Link>
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
                'radial-gradient(42% 55% at 12% 12%, rgba(124,58,237,0.18), transparent 70%),' +
                'radial-gradient(38% 50% at 88% 6%, rgba(14,165,233,0.20), transparent 70%),' +
                'radial-gradient(50% 55% at 72% 92%, rgba(236,72,153,0.16), transparent 70%)',
            }}
          />
        </div>
        <div className="mx-auto max-w-7xl px-5 py-16 text-center lg:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Meet the developers
            <span className="block bg-gradient-to-r from-indigo-600 via-sky-500 to-fuchsia-500 bg-clip-text text-transparent">
              behind this platform
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            A first-year engineer and a CSE professor working together to run {brand.competition}.
            Found a problem, want to say thanks, or have an idea for next year? Reach out below.
          </p>
        </div>
      </section>

      {/* ---------- Developer cards ---------- */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-8 md:grid-cols-2">
            {team.map((person) => (
              <article
                key={person.name}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img
                    src={person.image}
                    alt={`${person.name} — ${person.role}`}
                    className="h-full w-full object-cover object-center"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-slate-800 shadow-sm ring-1 ring-slate-200">
                    {person.role}
                  </span>
                </div>

                <div className="p-7">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{person.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{person.intro}</p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <a
                      href={`mailto:${person.email}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      <MailIcon className="h-3.5 w-3.5" /> {person.email}
                    </a>
                    {"github" in person && (
                      <a
                        href={`https://github.com/${person.github}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        <GithubIcon className="h-3.5 w-3.5" /> @{person.github}
                      </a>
                    )}
                    {"phone" in person && (
                      <a
                        href={`tel:${person.phone.replace(/\s/g, '')}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        <PhoneIcon className="h-3.5 w-3.5" /> {person.phone}
                      </a>
                    )}
                    <a
                      href={person.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      <LinkedinIcon className="h-3.5 w-3.5" /> LinkedIn
                    </a>
                  </div>
                </div>
              </article>
            ))}
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