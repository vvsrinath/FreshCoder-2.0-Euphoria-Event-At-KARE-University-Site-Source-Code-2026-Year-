import React, { useEffect, useState } from 'react';
import { MonitorIcon } from 'lucide-react';

/**
 * The examination interface is a desktop/laptop experience (1366×768 and up).
 * Small screens get a clear instruction instead of a squeezed exam UI.
 */
export function DesktopOnlyGate({ children }: {children: React.ReactNode;}) {
  const [tooSmall, setTooSmall] = useState(false);

  useEffect(() => {
    const check = () => setTooSmall(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (tooSmall) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-800 p-6">
        <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-panel">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MonitorIcon className="h-6 w-6" />
          </span>
          <h1 className="text-base font-semibold text-navy-800">Desktop or laptop required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Fresh Coders 2.0 is designed for desktop and laptop computers. Please use a PC or laptop
            to participate in the examination.
          </p>
        </div>
      </div>);

  }

  return <>{children}</>;
}