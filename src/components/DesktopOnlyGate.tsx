import React, { useEffect, useState } from 'react';
import { MonitorIcon } from 'lucide-react';

/**
 * The examination interface is a desktop/laptop experience (1366×768 and up).
 * Small screens get a clear instruction instead of a squeezed exam UI.
 */
export function DesktopOnlyGate({ children }: {children: React.ReactNode;}) {
  const [tooSmall, setTooSmall] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => {
      setTooSmall(window.innerWidth < 768);
      setIsPhone(window.innerWidth < 640);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (tooSmall && !dismissed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 p-4 sm:p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-panel sm:p-8">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MonitorIcon className="h-6 w-6" />
          </span>
          <h1 className="text-base font-semibold text-navy-800">Desktop or laptop recommended</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Fresh Coders 2.0 is designed for desktop and laptop computers (768px+). On smaller screens
            some layouts may be cramped, but you can continue on a tablet.
          </p>
          {!isPhone ? (
            <button type="button" onClick={() => setDismissed(true)} className="mt-5 w-full rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
              Continue anyway
            </button>
          ) : (
            <p className="mt-4 text-xs font-semibold text-amber-600">Please use a larger screen for the best experience. Phones are not supported for exams.</p>
          )}
        </div>
      </div>);

  }

  return <>{children}</>;
}