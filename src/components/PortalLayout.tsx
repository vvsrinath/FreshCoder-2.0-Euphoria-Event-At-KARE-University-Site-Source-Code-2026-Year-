import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, LogOutIcon, MenuIcon, XIcon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BrandMark } from './BrandMark';
import { GlobalFooter } from './GlobalFooter';
import { ConfirmDialog } from './ConfirmDialog';
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
        const blockList = ['Tab','w','t','n','r','R','i','I','j','J','c','C','u','U','s','S','p','P','a','A','f','F'];
        if (shift) blockList.push('Delete');
        if (blockList.includes(key)) {
          e.preventDefault(); e.stopPropagation();
          logViolation('COPY_BLOCKED', `Shortcut blocked: Ctrl+${shift ? 'Shift+' : ''}${key}`);
          return;
        }
      }
      if (e.altKey) { e.preventDefault(); e.stopPropagation(); logViolation('COPY_BLOCKED', `Alt+${key} blocked`); }
    };

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
    };
  }, [isStudent]);

  return (
    <div className={cn('flex min-h-screen w-full bg-[#f8fafc]', isStudent && 'secure-zone')}>
      {isStudent && (
        <style>{`.secure-zone, .secure-zone * { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; } .secure-zone input, .secure-zone textarea { user-select: text; -webkit-user-select: text; }`}</style>
      )}
      {/* Dark Navy Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white transition-transform duration-200 ease-out lg:static lg:translate-x-0 border-r border-black/10',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-black/5 px-5">
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
                        ? 'bg-black/[0.06] text-navy-900 font-semibold'
                        : 'text-slate-500 hover:bg-black/[0.04] hover:text-navy-900'
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
              className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-navy-900"
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
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-black/5 bg-white/90 px-5 sm:px-8 backdrop-blur">
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
              {headerRight}

              {/* User Profile Pill Avatar */}
              <div className="flex items-center gap-3 rounded-full border border-black/10 bg-black/[0.03] py-1.5 pl-2 pr-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-white font-semibold text-sm shadow-sm overflow-hidden">
                  {user?.name?.charAt(0) || <UserIcon className="h-4 w-4" />}
                </div>
                <div className="leading-tight text-left">
                  <span className="block text-xs font-black text-navy-900 tracking-tight">
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
          <main className="fc-scroll min-w-0 flex-1 p-5 sm:p-8">{children}</main>
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