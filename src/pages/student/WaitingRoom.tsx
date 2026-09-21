import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CalendarClockIcon, CircleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { BrandMark } from '../../components/BrandMark';
import { api } from '../../services/api';
import { eventConfig, guidelines } from '../../data/eventConfig';
import { formatClock, formatDateTime } from '../../utils/format';

const POLL_MS = 5000;

export function WaitingRoom() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await api.studentTest(id);
      offsetRef.current = new Date(res.serverTime).getTime() - Date.now();
      setData(res);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const poll = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!data?.test?.scheduledStart) return undefined;
    const tick = () => {
      const target = new Date(data.test.scheduledStart).getTime();
      setCountdown(Math.max(0, Math.round((target - (Date.now() + offsetRef.current)) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [data?.test?.scheduledStart]);

  const enter = async () => {
    setStarting(true);
    try {
      await api.startTest(id);
      navigate(`/student/tests/${id}/exam`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <LoadingState label="Loading test details…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const test = data.test;
  const live = test.status === 'ACTIVE';
  const paused = test.status === 'PAUSED';
  const finished = ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(data.attemptStatus);

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <BrandMark />
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon className="h-4 w-4" />} onClick={() => navigate('/student')}>
          Back to dashboard
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            {live ? 'Test is open' : paused ? 'Test paused' : 'Waiting for test'}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-navy-800">{test.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {eventConfig.name} · {eventConfig.subtitle}
          </p>
        </div>

        <Card className="mt-8 overflow-hidden">
          <div className="grid gap-px bg-slate-200 sm:grid-cols-4">
            {[
            ['Scheduled start', test.scheduledStart ? formatDateTime(test.scheduledStart) : 'On staff command'],
            ['Duration', `${test.durationMinutes} minutes`],
            ['Questions', String(test.questionCount)],
            ['Event', eventConfig.name]].
            map(([label, value]) =>
            <div key={label} className="bg-white px-4 py-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-navy-800">{value}</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-navy-800 px-6 py-8 text-center">
            {finished ?
            <p className="text-sm text-slate-200">
                You have already submitted this test. Results will be published by examination staff.
              </p> :
            live ?
            <>
                <p className="text-sm text-slate-300">Examination staff have started the test.</p>
                <Button size="lg" className="mt-4" loading={starting} onClick={enter}>
                  Start test
                </Button>
              </> :

            paused ?
            <>
                <p className="text-sm text-slate-300">The test is paused by examination staff.</p>
                <p className="mt-3 text-xs text-slate-400">
                  It will resume at the scheduled time. Keep this page open — the start button appears when staff reopen the test.
                </p>
              </> :

            <>
                <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <CalendarClockIcon className="h-4 w-4" /> Test starts in
                </p>
                <p className="mt-3 font-mono text-4xl font-semibold tabular-nums text-white">
                  {formatClock(countdown)}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {test.scheduledStart
                    ? `Scheduled for ${formatDateTime(test.scheduledStart)}. Staff can only open it at that time.`
                    : 'This page refreshes automatically. The start button appears when staff open the test.'}
                </p>
              </>
            }
          </div>
        </Card>

        <Card className="mt-6 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-800">
            <CircleAlertIcon className="h-4 w-4 text-accent-500" /> Important instructions
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            {guidelines.map((line) =>
            <li key={line} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                {line}
              </li>
            )}
          </ul>
        </Card>
      </main>
    </div>);

}