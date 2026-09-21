import React, { useCallback, useEffect, useState } from 'react';
import { MegaphoneIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { Button } from '../../components/Button';
import { formatDateTime } from '../../utils/format';

export function StaffAnnouncements() {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.staffAnnouncements();
      setItems(res.announcements ?? []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    const text = message.trim();
    if (!text) {
      toast.error('Write a message first.');
      return;
    }
    setSending(true);
    try {
      await api.postAnnouncement(text);
      toast.success('Announcement broadcast to all students.');
      setMessage('');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteAnnouncement(id);
      toast.success('Announcement removed.');
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900 mb-1">
        <MegaphoneIcon className="h-4 w-4 text-brand-600" />
        Broadcast announcements
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Shown as a banner to every student portal within 15 seconds, until removed.
      </p>
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') post();
          }}
          placeholder="e.g. The paper analysis session is now live — join the hall."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-white/15 dark:bg-navy-900 dark:text-white"
        />
        <Button icon={<MegaphoneIcon className="h-4 w-4" />} loading={sending} onClick={post} disabled={!message.trim()}>
          Broadcast
        </Button>
      </div>

      {loading ? null : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No active announcements.</p>
      ) : (
        <ul className="mt-4 divide-y divide-black/5">
          {items.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy-800">{a.message}</p>
                <p className="text-[11px] text-slate-400">Posted {formatDateTime(a.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(a.id)}
                className="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Remove announcement"
              >
                <Trash2Icon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}