import { useEffect, useRef, useState } from 'react';

/**
 * Server-push explicitly for BOTH capture and push:
 * 1. sets up visibility-gated polling as baseline
 * and 2. tries to upgrade to raw text/event-stream, and
 * gracefully falls back to polling on any failure.
 */

interface UseLiveOptions {
  /** Millisecond interval for the polling fallback. */
  intervalMs: number;
  /** Refresh callback — invoked on each poll tick or SSE push event. */
  onEvent: () => void;
  /** SSE channel name; pass null to force polling-only mode. */
  channel?: string | null;
}

export type LiveMode = 'polling' | 'live';

export function useLive({ intervalMs, onEvent, channel }: UseLiveOptions): { mode: LiveMode } {
  const fnRef = useRef(onEvent);
  fnRef.current = onEvent;
  const [mode, setMode] = useState<LiveMode>('polling');

  useEffect(() => {
    let cancelled = false;
    let pollId: number | undefined;
    let control: AbortController | undefined;
    let reconnectTimer: number | undefined;
    let attempts = 0;

    const stopPolling = () => window.clearInterval(pollId);
    const startPolling = () => {
      window.clearInterval(pollId);
      pollId = window.setInterval(() => {
        if (!document.hidden) fnRef.current();
      }, intervalMs);
    };

    const syncPolling = () => (document.hidden ? stopPolling() : startPolling());

    if (!channel) {
      startPolling();
      setMode('polling');
      document.addEventListener('visibilitychange', syncPolling);
      return () => {
        cancelled = true;
        stopPolling();
        document.removeEventListener('visibilitychange', syncPolling);
      };
    }

    const isProd = (import.meta as unknown as { env?: Record<string, string> }).env?.PROD === 'true';
    const base = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || '';

    const connect = async () => {
      if (cancelled) return;
      const url = `${base}/.netlify/functions/stream?channel=${encodeURIComponent(channel as string)}`;
      const token = sessionStorage.getItem('fc_session_token');
      const controller = new AbortController();
      control = controller;
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error('stream-unavailable');
        attempts = 0;
        stopPolling();
        setMode('live');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value || document.hidden) continue;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            if (part.includes('data:')) fnRef.current();
          }
        }
        throw new Error('stream-closed');
      } catch {
        // fall through to fallback
      } finally {
        control = undefined;
        if (!cancelled) {
          setMode('polling');
          startPolling();
          const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
          reconnectTimer = window.setTimeout(connect, delay + (isProd ? 0 : 0));
        }
      }
    };

    connect();
    document.addEventListener('visibilitychange', syncPolling);

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      stopPolling();
      control?.abort();
      document.removeEventListener('visibilitychange', syncPolling);
    };
  }, [intervalMs, channel]);

  return { mode };
}