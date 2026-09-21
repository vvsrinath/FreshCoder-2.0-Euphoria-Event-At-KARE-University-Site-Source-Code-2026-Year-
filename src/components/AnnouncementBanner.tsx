import React, { useCallback, useEffect, useState } from 'react';
import { MegaphoneIcon, XIcon } from 'lucide-react';
import { api } from '../services/api';
import { useLive } from '../hooks/useLive';

const DISMISS_KEY = 'fc_dismissed_announcements';

function dismissals(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const [items, setItems] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(dismissals);

  const load = useCallback(async () => {
    try {
      const res = await api.studentAnnouncements();
      setItems(res.announcements ?? []);
    } catch {
      /* student route only — staff portal ignores */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLive({ intervalMs: 15000, onEvent: load, channel: 'student-announcements' });

  const hide = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <MegaphoneIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1 text-sm font-medium leading-relaxed">{a.message}</p>
          <button
            type="button"
            onClick={() => hide(a.id)}
            className="rounded p-1 text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-white/10"
            aria-label="Dismiss announcement"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}