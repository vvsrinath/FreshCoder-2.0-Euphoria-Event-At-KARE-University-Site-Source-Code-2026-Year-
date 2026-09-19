import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EyeIcon, EyeOffIcon, KeyRoundIcon, LockIcon, UserIcon, ArrowRightIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { UniversityMark } from '../components/UniversityMark';
import { GlobalFooter } from '../components/GlobalFooter';
import { useAuth } from '../contexts/AuthContext';
import { brand, eventConfig } from '../data/eventConfig';
import { demoCredentials } from '../data/seedUsers';
import { cn } from '../utils/cn';

const CAMPUS_IMAGE = "/landing-hero.jpg";

type Portal = 'STUDENT' | 'STAFF' | 'ADMIN';

const portals: { key: Portal; label: string; idLabel: string; defaultId: string }[] = [
  { key: 'STUDENT', label: 'Student', idLabel: 'Student ID', defaultId: 'ST2026001' },
  { key: 'STAFF', label: 'Staff', idLabel: 'Staff ID', defaultId: 'SF2026' },
  { key: 'ADMIN', label: 'Admin', idLabel: 'Admin ID', defaultId: 'AD2026' },
];

export function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const initial = (params.get('portal') as Portal) ?? 'STUDENT';
  const [portal, setPortal] = useState<Portal>(
    portals.some((p) => p.key === initial) ? initial : 'STUDENT'
  );
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const active = portals.find((p) => p.key === portal)!;

  const handleQuickFill = (id: string, pass: string) => {
    setUserId(id);
    setPassword(pass);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(userId.trim(), password, portal);
      const destination =
        user.role === 'STUDENT' ? '/student' : user.role === 'STAFF' ? '/staff' : '/admin';
      navigate(destination, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col justify-between">
      <div className="grid min-h-[calc(100vh-80px)] w-full lg:grid-cols-[1.1fr_1.2fr]">
        {/* Left Visual Column */}
        <aside className="relative hidden overflow-hidden bg-[#0a1026] lg:flex lg:flex-col justify-between p-10 lg:p-14 text-white">
          <img
            src={CAMPUS_IMAGE}
            alt="Fresh Coders 2.0 examination hall at Kalasalingam"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-30 filter brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1026] via-[#0a1026]/60 to-transparent" />

          {/* Top Brand Header */}
          <div className="relative z-10">
            <Link to="/" className="inline-block transition-transform hover:scale-[1.02]">
              <UniversityMark tone="light" size="lg" />
            </Link>
            <div className="mt-8">
              <p className="text-2xl font-black uppercase tracking-wider text-white">
                FRESH <span className="text-sky-400">CODERS 2.0</span>
              </p>
            </div>
          </div>

          {/* Middle/Bottom Large Motivational Typography */}
          <div className="relative z-10 my-auto py-12">
            <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight text-white tracking-tight">
              Think <br />
              <span className="text-sky-400">Solve</span> <br />
              Build <br />
              <span className="text-slate-200 text-3xl xl:text-4xl font-light">a Better Tomorrow</span>
            </h2>
          </div>

          {/* Bottom Event Tagline */}
          <div className="relative z-10 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              {brand.tagline}
            </p>
          </div>
        </aside>

        {/* Right Form Card Column */}
        <main className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md space-y-6">
            <div className="lg:hidden flex justify-center mb-4">
              <UniversityMark />
            </div>

            {/* Elevated Auth Card */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/50">
              <h1 className="text-center text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">
                Welcome Back
              </h1>
              <p className="mt-1.5 text-center text-sm text-slate-500 font-medium">
                Login to access the Fresh Coders 2.0 portal
              </p>

              {/* Role Switcher Tabs */}
              <div
                className="mt-7 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1.5"
                role="tablist"
              >
                {portals.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={portal === item.key}
                    onClick={() => {
                      setPortal(item.key);
                      setError(null);
                    }}
                    className={cn(
                      'rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all duration-150',
                      portal === item.key
                        ? 'bg-[#0f172a] text-white shadow-md'
                        : 'text-slate-600 hover:text-navy-900 hover:bg-slate-200/60'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Login Form */}
              <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                <TextField
                  label={active.idLabel}
                  placeholder={`Enter your ${active.idLabel.toLowerCase()}`}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  icon={<UserIcon className="h-4 w-4 text-slate-400" />}
                  autoComplete="username"
                  required
                />

                <div className="relative">
                  <TextField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<LockIcon className="h-4 w-4 text-slate-400" />}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-[34px] text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm font-medium text-red-700"
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f172a] py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-slate-900/30 disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Login'}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-400 font-medium">
                Only authorized participants can access this portal.
              </p>

              {/* Motivational Quote Box at bottom of card */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
                <p className="text-xs italic text-slate-700 font-medium">
                  "{brand.quote}"
                </p>
                <p className="mt-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  — Euphoria 2026
                </p>
              </div>
            </div>

            {/* Dev Demo Quick-Fill Accounts */}
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                <KeyRoundIcon className="h-3.5 w-3.5 text-blue-600" /> Demo Quick-Fill Credentials
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.id}
                    type="button"
                    onClick={() => handleQuickFill(cred.id, cred.password)}
                    className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-2 text-center transition-all hover:border-blue-500 hover:bg-blue-50"
                  >
                    <span className="text-[11px] font-bold text-navy-800">{cred.label}</span>
                    <span className="font-mono text-[10px] text-slate-500">{cred.id}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs">
              <Link to="/" className="font-semibold text-blue-600 hover:underline">
                ← Back to event home
              </Link>
            </p>
          </div>
        </main>
      </div>

      {/* Global Persistent Footer */}
      <GlobalFooter />
    </div>
  );
}