import React, { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';
import { applyTheme, currentTheme, type Theme } from '../utils/theme';
import { cn } from '../utils/cn';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'light' : currentTheme()));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
        'text-slate-500 hover:bg-black/5 hover:text-navy-900',
        'dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white',
        className
      )}
    >
      {theme === 'dark' ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
    </button>
  );
}