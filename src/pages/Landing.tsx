import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  AwardIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  Code2Icon,
  MapPinIcon,
  MenuIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { UniversityMark } from '../components/UniversityMark';
import { GlobalFooter } from '../components/GlobalFooter';
import { brand, eventConfig, guidelines } from '../data/eventConfig';

const HERO_IMAGE = "/landing-hero.jpg";
const EUPHORIA_LOGO = "/euphoria-logo.png";

const NAV_LINKS: ReadonlyArray<
  | { label: string; href: string }
  | { label: string; to: string }
> = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Event', href: '#event' },
  { label: 'Guidelines', href: '#guidelines' },
  { label: 'Developers', to: '/developers' },
  { label: 'Convenors', to: '/convenors' },
];

export function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f5f5f7] text-slate-900 font-sans flex flex-col selection:bg-brand-500 selection:text-white">
      {/* ---------- Navigation ---------- */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <Link to="/" className="shrink-0" aria-label="Kalasalingam home">
            <UniversityMark tone="light" />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) =>
              'to' in link ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login?portal=STUDENT"
              className="inline-flex items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-brand-600"
            >
              Student Portal
            </Link>
            <Link
              to="/login?portal=STAFF"
              className="hidden sm:inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              Staff Portal
            </Link>
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
            >
              {mobileOpen ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden" />
            <nav className="absolute inset-x-0 top-16 z-40 border-b border-slate-200 bg-white px-5 py-4 shadow-lg lg:hidden">
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((link) =>
                  'to' in link ? (
                    <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      {link.label}
                    </Link>
                  ) : (
                    <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      {link.label}
                    </a>
                  )
                )}
                <Link to="/login?portal=STAFF" onClick={() => setMobileOpen(false)} className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 sm:hidden">
                  Staff Portal
                </Link>
              </div>
            </nav>
          </>
        )}
      </header>

      {/* ---------- Hero ---------- */}
      <section id="home" className="relative overflow-hidden">
        {/* Full-bleed photography */}
        <img
          src={HERO_IMAGE}
          alt={`${brand.competition} examination hall at Kalasalingam, spread across the page`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Legibility scrims */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-950/45"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/30 to-transparent"
        />

        <div className="relative mx-auto flex min-h-[94vh] max-w-7xl flex-col justify-end px-5 py-16 lg:py-24">
          {/* Copy */}
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-5xl lg:text-7xl">
              {brand.competition}
              <br />
              coding exams, made human.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-200">
              {brand.competition} is the student coding examination of {eventConfig.name} — built
              and run by students and faculty for everyone in the first year. One computer, one
              door to the {eventConfig.prizePool} prize pool.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-medium text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-brand-400" /> {eventConfig.date}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4 text-brand-400" /> {eventConfig.time}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-400" />
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4 text-brand-400" /> {eventConfig.venueBlock},{' '}
                {eventConfig.venueRooms}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login?portal=STUDENT"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100"
              >
                Take the test <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a
                href="#event"
                className="inline-flex items-center gap-1 rounded-full px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/40 backdrop-blur transition-colors hover:bg-white/10"
              >
                About the event <ChevronRightIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Quick facts ---------- */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 md:grid-cols-4">
          {[
            { icon: AwardIcon, label: 'Prize pool', value: eventConfig.prizePool },
            { icon: TicketIcon, label: 'Registration', value: `${eventConfig.registrationFee} ${eventConfig.registrationFeeNote}` },
            { icon: UsersIcon, label: 'Eligible', value: 'All first-year students' },
            { icon: ShieldCheckIcon, label: 'Proctored', value: 'Live, monitored exams' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3" >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/5 text-slate-500">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- About ---------- */}
      <section id="about" className="py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <img
              src={HERO_IMAGE}
              alt={`${brand.competition} at ${eventConfig.name}`}
              className="col-span-2 aspect-[16/9] w-full rounded-2xl object-cover shadow-md"
            />
            <div className="flex items-center justify-center rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-md">
              <img
                src={EUPHORIA_LOGO}
                alt={`${eventConfig.name} logo`}
                className="max-h-28 w-auto object-contain"
              />
            </div>
            <div className="flex flex-col justify-center rounded-2xl bg-slate-50 p-5 ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Our ethos</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-navy-900">
                "{brand.motto}"
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">About the exam</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              First year, first try — on a platform we built ourselves.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">
              {eventConfig.name} brings together every first-year student for a morning of coding,
              debugging and logic. {brand.competition} runs it on an examination platform designed
              for exactly this room: timed, proctored and graded automatically as you finish.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Multiple-choice, output and code-completion rounds that grade themselves',
                'Live proctoring — leaving fullscreen or switching tabs is recorded, not punished blindly',
                'A results screen that shows where you gained and lost marks',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <a
              href={`https://${eventConfig.registrationSite}`}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Register on {eventConfig.registrationSite}
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Event: schedule + guidelines ---------- */}
      <section id="event" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Event day</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              {eventConfig.date}, in the 11th Block
            </h2>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {/* Schedule */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Schedule</h3>
              <ol className="mt-5 space-y-5 border-l-2 border-black/10 pl-5">
                {[
                  { time: '09:00 AM', title: 'Reporting & verification', desc: 'System check at Room 11506 & 11507' },
                  { time: '09:30 AM', title: 'Python fundamentals', desc: 'Official test starts simultaneously for everyone' },
                  { time: '11:30 AM', title: 'Coding & debugging', desc: 'Second-tier challenges, same platform' },
                  { time: '01:00 PM', title: 'Results & closing', desc: 'Evaluation wraps up and winners are announced' },
                ].map((item) => (
                  <li key={item.time} className="relative">
                    <span aria-hidden className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-brand-500 bg-white" />
                    <p className="text-sm font-semibold text-brand-600">{item.time}</p>
                    <p className="mt-0.5 text-sm font-semibold text-navy-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{item.desc}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Guidelines */}
            <div id="guidelines">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Guidelines</h3>
              <ul className="mt-5 space-y-3 rounded-2xl bg-white p-6 ring-1 ring-black/5 shadow-sm">
                {guidelines.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-black/5">
                <Code2Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                Need help on the day? Reach any examination staff in the room, or contact the team
                below before the event.
              </p>
            </div>
          </div>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}