import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, LogOutIcon, MenuIcon, XIcon, UserIcon, ShieldAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from './BrandMark';
import { GlobalFooter } from './GlobalFooter';
import { ConfirmDialog } from './ConfirmDialog';
import { ThemeToggle } from './ThemeToggle';
import { AnnouncementBanner } from './AnnouncementBanner';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { cn } from '../utils/cn';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface PortalLayoutProps {
  portalLabel: string;
  navItems: NavItem[];
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  navFooter?: React.ReactNode;
}

export function PortalLayout({ portalLabel, navItems, children, headerRight, navFooter }: PortalLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [devtoolsViolations, setDevtoolsViolations] = useState(0);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login');
  };

  const isStudent = user?.role === 'STUDENT';
  const roleDisplay = isStudent ? 'Student' : 'Staff';
  const defaultId = '—';

  // Student pages: HackerRank-style — block copy/paste/cut + log telemetry + disable text selection
  useEffect(() => {
    if (!isStudent) return;

    const logViolation = (event: string, detail: string) => {
      // Telemetry to backend (fire-and-forget)
      api.reportEvent(event, detail).catch(() => undefined);
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Copy is disabled during the examination.');
      const sel = window.getSelection()?.toString() || '';
      logViolation('COPY_BLOCKED', `Copy blocked — ${sel.length} chars selected`);
    };
    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Cut is disabled during the examination.');
      logViolation('COPY_BLOCKED', 'Cut blocked');
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.error('Pasting is disabled — please type your answer.');
      const pasted = (e.clipboardData || (window as unknown as { clipboardData?: DataTransfer }).clipboardData)?.getData('text') || '';
      logViolation('COPY_BLOCKED', `Paste blocked — ${pasted.length} chars attempted`);
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('CONTEXT_MENU_BLOCKED', 'Right-click blocked on student portal');
    };
    const onDragStart = (e: DragEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      if (/^F\d{1,2}$/.test(key) || key === 'PrintScreen') {
        e.preventDefault(); e.stopPropagation(); (e as unknown as { stopImmediatePropagation: () => void }).stopImmediatePropagation?.();
        toast.error(`${key} is disabled during the examination.`);
        logViolation('COPY_BLOCKED', `Function key blocked: ${key}`);
        return;
      }
      if (key === 'Escape') { e.preventDefault(); e.stopPropagation(); return; }
      if (ctrl) {
        const blockList = ['Tab','w','t','n','r','R','i','I','j','J','c','C','u','U','s','S','p','P','a','A','f','F','m','M','e','E','k','K'];
        if (shift) blockList.push('Delete');
        if (blockList.includes(key)) {
          e.preventDefault(); e.stopPropagation();
          logViolation('COPY_BLOCKED', `Shortcut blocked: Ctrl+${shift ? 'Shift+' : ''}${key}`);
          return;
        }
      }
      if (e.altKey) { e.preventDefault(); e.stopPropagation(); logViolation('COPY_BLOCKED', `Alt+${key} blocked`); }
    };

    // Banking-style DevTools open detection (docked/undocked) so Inspect & F12 can be policed
    let devtoolsDetected = false;
    let violationCount = 0;
    const detectDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const isOpen = widthDiff > 150 || heightDiff > 150;
      if (isOpen && !devtoolsDetected) {
        devtoolsDetected = true;
        violationCount++;
        setDevtoolsViolations(violationCount);
        api.reportEvent('DEVTOOLS_ATTEMPT', `DevTools detected via window size (${widthDiff}x${heightDiff}) #${violationCount}`).catch(() => undefined);
        setDevtoolsOpen(true);
      } else if (!isOpen && devtoolsDetected) {
        devtoolsDetected = false;
        setDevtoolsOpen(false);
      }
      if (!devtoolsDetected) {
        const start = performance.now();
        // eslint-disable-next-line no-debugger
        debugger;
        if (performance.now() - start > 80) {
          devtoolsDetected = true;
          violationCount++;
          setDevtoolsViolations(violationCount);
          api.reportEvent('DEVTOOLS_ATTEMPT', `DevTools detected via debugger timing #${violationCount}`).catch(() => undefined);
          setDevtoolsOpen(true);
        }
      }
    };
    const devtoolsInterval = window.setInterval(detectDevTools, 500);

    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('cut', onCut, true);
    document.addEventListener('paste', onPaste, true);
    document.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('cut', onCut, true);
      document.removeEventListener('paste', onPaste, true);
      document.removeEventListener('dragstart', onDragStart, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.clearInterval(devtoolsInterval);
    };
  }, [isStudent]);

  return (
    <div className={cn('flex min-h-screen w-full bg-[#f8fafc] dark:bg-[#161617]', isStudent && 'secure-zone')}>
      {isStudent && (
        <style>{`.secure-zone, .secure-zone * { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; } .secure-zone input, .secure-zone textarea { user-select: text; -webkit-user-select: text; }`}</style>
      )}

      {/* DevTools Blocker — portal hidden until DevTools is closed */}
      {isStudent && devtoolsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0a1026] p-6">
          <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-[#0d162f]/95 p-10 text-center shadow-2xl backdrop-blur-md">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-600/30 text-red-400 border-2 border-red-500/50 animate-pulse">
              <ShieldAlertIcon className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Developer Tools Detected</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              <strong className="text-red-400">Inspection is strictly prohibited</strong> on the student portal.
              Developer Tools must be closed to continue.
            </p>
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold text-amber-400">
                To close Developer Tools:<br />
                Press <kbd className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">F12</kbd> or
                <kbd className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Ctrl+Shift+I</kbd> again,
                or click the X in the DevTools panel.
              </p>
            </div>
            <p className="mt-3 text-xs font-semibold text-red-400">
              This violation has been recorded. ({devtoolsViolations} total)
            </p>
            <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-[11px] text-red-300">
                Staff will be notified. Right-click Inspect, F12 and copy/paste are disabled on this portal.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Dark Navy Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white transition-transform duration-200 ease-out lg:static lg:translate-x-0 border-r border-black/10 dark:bg-navy-950 dark:border-white/10',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-black/5 px-5 dark:border-white/10">
          <BrandMark tone="dark" />
          <button
            type="button"
            className="rounded p-1.5 text-slate-400 hover:bg-black/5 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label={`${portalLabel} navigation`} className="fc-scroll flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-black/[0.06] text-navy-900 font-semibold dark:bg-white/10 dark:text-white'
                        : 'text-slate-500 hover:bg-black/[0.04] hover:text-navy-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
                    )
                  }
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer: profile/logout (portal-provided) or default logout */}
        <div className="border-t border-white/10 p-4">
          {navFooter ?? (
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-navy-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOutIcon className="h-4 w-4" />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-black/5 bg-white/90 px-5 sm:px-8 backdrop-blur dark:border-white/10 dark:bg-navy-950/90">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              <div className="lg:hidden">
                <BrandMark tone="dark" />
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <ThemeToggle />
              {headerRight}

              {/* User Profile Pill Avatar */}
              <div className="flex items-center gap-3 rounded-full border border-black/10 bg-black/[0.03] py-1.5 pl-2 pr-4 dark:border-white/15 dark:bg-white/[0.06]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-white font-semibold text-sm shadow-sm overflow-hidden">
                  {user?.name?.charAt(0) || <UserIcon className="h-4 w-4" />}
                </div>
                <div className="leading-tight text-left">
                  <span className="block text-xs font-black text-navy-900 tracking-tight dark:text-white">
                    {user?.id || defaultId}
                  </span>
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">
                    {roleDisplay}
                  </span>
                </div>
                <ChevronDownIcon className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          </header>

          {/* Page Body */}
          <main className="fc-scroll min-w-0 flex-1 p-5 sm:p-8">
            {isStudent && <AnnouncementBanner />}
            {children}
          </main>
        </div>

        {/* Persistent Bottom Footer */}
        <GlobalFooter />
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You will need your ID and password to sign back in."
        confirmLabel="Sign out"
        destructive
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}