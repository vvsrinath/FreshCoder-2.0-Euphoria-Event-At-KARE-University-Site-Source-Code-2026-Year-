import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, LogOutIcon, MenuIcon, XIcon, UserIcon } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { GlobalFooter } from './GlobalFooter';
import { useAuth } from '../contexts/AuthContext';
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
}

export function PortalLayout({ portalLabel, navItems, children, headerRight }: PortalLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isStudent = user?.role === 'STUDENT';
  const roleDisplay = isStudent ? 'Student' : 'Staff';
  const defaultId = isStudent ? 'ST2026001' : 'SF2026';

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc]">
      {/* Dark Navy Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0a1026] transition-transform duration-200 ease-out lg:static lg:translate-x-0 border-r border-slate-800',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <BrandMark tone="light" />
          <button
            type="button"
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label={`${portalLabel} navigation`} className="fc-scroll flex-1 overflow-y-auto p-4">
          <ul className="space-y-1.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150',
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:bg-white/10 hover:text-white'
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

        {/* Sidebar Logout Button */}
        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 transition-all hover:bg-white/10 hover:text-white"
          >
            <LogOutIcon className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-[#0a1026]/70 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 sm:px-8 shadow-xs">
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
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50/80 py-1.5 pl-2 pr-4 shadow-2xs">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white font-black text-sm shadow-sm overflow-hidden">
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
    </div>
  );
}