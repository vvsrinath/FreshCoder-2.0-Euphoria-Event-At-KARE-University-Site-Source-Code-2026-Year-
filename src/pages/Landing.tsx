import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  CodeXmlIcon,
  GlobeIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  UsersIcon,
  AwardIcon,
  TicketIcon,
  CheckCircle2Icon,
  LayersIcon,
} from 'lucide-react';
import { UniversityMark } from '../components/UniversityMark';
import { GlobalFooter } from '../components/GlobalFooter';
import { brand, contact, eventConfig, guidelines } from '../data/eventConfig';

const HERO_CAMPUS_IMAGE = "/c6eca028-31ed-407d-b80d-29669c42bb02.jpg";

export function Landing() {
  return (
    <div className="min-h-screen w-full bg-[#080d1f] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080d1f]/90 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="transition-transform hover:scale-[1.01]">
            <UniversityMark tone="light" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {[
              { label: 'Home', href: '#home', active: true },
              { label: 'About', href: '#about' },
              { label: 'Event', href: '#event' },
              { label: 'Guidelines', href: '#guidelines' },
              { label: 'Contact', href: '#contact' },
            ].map(({ label, href, active }) => (
              <a
                key={label}
                href={href}
                className={`text-sm font-semibold transition-colors duration-150 ${
                  active ? 'text-sky-400 border-b-2 border-sky-400 pb-1' : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Portal Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/login?portal=STUDENT"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all duration-150 hover:bg-blue-500 hover:shadow-blue-500/50"
            >
              Student Portal
            </Link>
            <Link
              to="/login?portal=STAFF"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-200 backdrop-blur-sm transition-all duration-150 hover:bg-white/15 hover:text-white"
            >
              Staff Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative isolate overflow-hidden pt-8 pb-16 lg:pt-12 lg:pb-24">
        {/* Background Campus Building with Dark Cosmic Overlay */}
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <img
            src={HERO_CAMPUS_IMAGE}
            alt="Kalasalingam University Campus"
            className="h-full w-full object-cover object-left-bottom opacity-15 filter contrast-125 brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080d1f] via-[#080d1f]/80 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.25),rgba(255,255,255,0))]" />
        </div>

        {/* Floating Stars / Celestial Particle Effects */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:32px_32px] opacity-20" />

        <div className="relative mx-auto max-w-7xl px-5">
          {/* Main Hero Header Row */}
          <div className="flex flex-col lg:flex-row items-start justify-between gap-8 pt-4">
            {/* Left Title & Department */}
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-bold tracking-[0.22em] text-sky-300 uppercase">
                <SparklesIcon className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                {brand.department}
              </div>

              <h1 className="mt-5 text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.02]">
                <span className="text-white drop-shadow-sm">FRESH </span>
                <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent filter drop-shadow-[0_0_25px_rgba(56,189,248,0.45)]">
                  CODERS 2.0
                </span>
              </h1>

              <p className="mt-3 text-sm sm:text-base font-extrabold uppercase tracking-[0.35em] text-sky-300/90 flex items-center gap-2">
                <span>CODE</span>
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                <span>COMPETE</span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
                <span>CONQUER</span>
              </p>

              {/* Event Info Pills Row */}
              <div className="mt-7 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-medium text-slate-200">
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 backdrop-blur-md shadow-sm">
                  <CalendarIcon className="h-4 w-4 text-sky-400" />
                  <span>{eventConfig.date}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 backdrop-blur-md shadow-sm">
                  <ClockIcon className="h-4 w-4 text-sky-400" />
                  <span>{eventConfig.time}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 backdrop-blur-md shadow-sm">
                  <MapPinIcon className="h-4 w-4 text-sky-400" />
                  <span>{eventConfig.venueBlock}, {eventConfig.venueRooms}</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/login?portal=STUDENT"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-blue-600/40 transition-all hover:bg-blue-500 hover:scale-[1.02]"
                >
                  Student Portal
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a
                  href="#event"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-[1.02]"
                >
                  Event Details
                  <ArrowRightIcon className="h-4 w-4 text-slate-300" />
                </a>
              </div>
            </div>

            {/* Right Euphoria 2026 Badge & Portrait */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center lg:items-end gap-6 shrink-0">
              {/* Founder Circular Badge */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2.5 rounded-2xl backdrop-blur-md shadow-lg">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/20 shadow-md shadow-amber-400/20 overflow-hidden">
                  <span className="text-2xl font-bold">🎓</span>
                </div>
                <div className="text-left leading-tight">
                  <p className="text-xs font-bold text-amber-300 tracking-wide">
                    "{brand.motto}"
                  </p>
                  <p className="text-[10px] text-slate-300 uppercase tracking-widest mt-0.5">
                    Kalasalingam Vision
                  </p>
                </div>
              </div>

              {/* Euphoria 2026 Badge Card */}
              <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-blue-950/60 via-[#0d1c3a]/70 to-[#1e143b]/60 p-5 backdrop-blur-md shadow-xl max-w-xs text-left">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                    <LayersIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-lg font-black tracking-tight text-white">
                      EUPHORIA <span className="text-sky-400">2026</span>
                    </p>
                    <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
                      {eventConfig.subtitle}
                    </p>
                  </div>
                </div>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                    Theme · {eventConfig.theme}
                  </span>
                  <p className="mt-2 text-xs italic text-slate-300">
                    "{brand.quote}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Floating Glassmorphism Feature Cards */}
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {/* Card 1: Coding Challenge */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d162f]/80 p-6 backdrop-blur-md shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-sky-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                <CodeXmlIcon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                Coding Challenge
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Compete through programming and technical challenges set by the department.
              </p>
            </div>

            {/* Card 2: Skill Assessment */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d162f]/80 p-6 backdrop-blur-md shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-purple-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-600/30">
                <AwardIcon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                Skill Assessment
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Test programming knowledge, logic and debugging skills.
              </p>
            </div>

            {/* Card 3: Innovation */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d162f]/80 p-6 backdrop-blur-md shadow-xl transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-emerald-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                <TargetIcon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Innovation
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Solve problems and build better solutions for sustainable future.
              </p>
            </div>
          </div>

          {/* Floating Key Info / Stats Banner Strip */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl text-navy-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {/* Stat 1: Prize Pool */}
              <div className="flex items-center gap-3.5 px-4 py-2.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600">
                  <AwardIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xl font-black text-navy-900 tracking-tight">{eventConfig.prizePool}</p>
                  <p className="text-xs font-semibold text-slate-500">Prize Pool</p>
                </div>
              </div>

              {/* Stat 2: Registration Fee */}
              <div className="flex items-center gap-3.5 px-4 py-2.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <TicketIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xl font-black text-navy-900 tracking-tight">{eventConfig.registrationFee}</p>
                  <p className="text-xs font-semibold text-slate-500">Registration Fee (per student)</p>
                </div>
              </div>

              {/* Stat 3: Eligibility */}
              <div className="flex items-center gap-3.5 px-4 py-2.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <UsersIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Open to</p>
                  <p className="text-sm font-bold text-navy-900">All First Year Students</p>
                </div>
              </div>

              {/* Stat 4: Register At */}
              <div className="flex items-center gap-3.5 px-4 py-2.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                  <GlobeIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Register at</p>
                  <a
                    href={`https://${eventConfig.registrationSite}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    {eventConfig.registrationSite}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Micro Footer Row in Hero */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p className="italic">
              "{brand.quote}"
            </p>
            <div className="flex items-center gap-4 text-slate-400">
              <a href="#" className="hover:text-white transition-colors" aria-label="Facebook">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Twitter">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="LinkedIn">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64c-.88 0-1.6.72-1.6 1.6s.72 1.6 1.6 1.6 1.6-.72 1.6-1.6-.72-1.6-1.6-1.6z"/></svg>
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Instagram">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Guidelines Section */}
      <section id="guidelines" className="bg-[#0b1228] border-y border-white/10 py-16">
        <div className="mx-auto max-w-7xl px-5">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
                <ShieldCheckIcon className="h-4 w-4" /> Examination Rules
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">
                Participation Guidelines
              </h2>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                Fresh Coders 2.0 runs on the Kalasalingam University Freshman Engineering Examination Platform.
                Please ensure you adhere to all requirements before beginning your test.
              </p>

              <ul className="mt-6 space-y-3">
                {guidelines.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle2Icon className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Schedule Card */}
            <div className="rounded-2xl border border-white/10 bg-[#070c1e] p-7 shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">
                Event Schedule · 26 September 2026
              </h3>
              <div className="mt-5 space-y-4">
                {[
                  { time: '09:00 AM', title: 'Reporting & Verification', desc: 'System check at 11th Block, Room 11506 & 11507' },
                  { time: '09:30 AM', title: 'Python Fundamentals Assessment', desc: 'Official test starts simultaneously' },
                  { time: '11:30 AM', title: 'Coding & Debugging Round', desc: 'Second tier programming challenges' },
                  { time: '01:00 PM', title: 'Session Conclusion', desc: 'Results evaluation and closing' },
                ].map((item) => (
                  <div key={item.time} className="flex gap-4 border-l-2 border-sky-500/30 pl-4 py-1">
                    <span className="font-mono text-sm font-bold text-sky-400 shrink-0 w-20">
                      {item.time}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Global Persistent Footer */}
      <GlobalFooter />
    </div>
  );
}