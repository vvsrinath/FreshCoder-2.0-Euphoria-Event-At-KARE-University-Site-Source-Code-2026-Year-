import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { StaffNavFooter, staffNav } from './staffNav';
import { api } from '../../services/api';
import type { Test } from '../../types';
import { useLive } from '../../hooks/useLive';

const TYPE_LABELS: Record<string, string> = {
  MIXED: 'Mixed',
  MCQ: 'MCQ',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in Blank',
  OUTPUT: 'Output',
  CODE_COMPLETION: 'Code Completion',
  DEBUGGING: 'Debugging',
  CODING: 'Programming',
  QUIZ: 'Quiz',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Live',
  SCHEDULED: 'Scheduled',
  PAUSED: 'Paused',
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-white text-slate-600 border-black/10',
  SCHEDULED: 'bg-white text-slate-600 border-black/10',
  PAUSED: 'bg-white text-slate-600 border-black/10',
  DRAFT: 'bg-white text-slate-600 border-black/10',
  COMPLETED: 'bg-white text-slate-600 border-black/10',
  ARCHIVED: 'bg-white text-slate-600 border-black/10',
};

function formatSchedule(value: string | null | undefined): string {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function statusBadge(status: string) {
  const label = STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
      {label}
    </span>
  );
}

export function TestManagement() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.tests();
      setTests(res.tests);
      setError(null);
    } catch (err) {
      if (initial) {
        setError((err as Error).message);
      }
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  useLive({ intervalMs: 15000, onEvent: () => load(false), channel: 'staff-testmanagement' });

  const startTest = useCallback(
    async (row: Test) => {
      try {
        await api.startTestAsStaff(row.id);
        toast.success(`Starting ${row.name}`);
        setTests((prev) =>
          prev.map((t) => (t.id === row.id ? { ...t, status: 'ACTIVE' } : t))
        );
        load();
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [load]
  );

  const isStartableNow = (t: Test): boolean => {
    if (!t.scheduledStart) return true;
    const at = new Date(String(t.scheduledStart).replace(' ', 'T')).getTime();
    return !Number.isNaN(at) && at <= Date.now();
  };

  const deleteTest = useCallback(
    async (row: Test) => {
      if (!window.confirm(`Archive ${row.name}? This cannot be undone for the current session.`)) return;
      try {
        await api.deleteTest(row.id);
        toast.success(`Archived ${row.name}`);
        load();
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [load]
  );

  const displayTests = useMemo(
    () =>
      tests.map((t) => ({
        ...t,
        typeLabel: TYPE_LABELS[t.type] ?? t.type,
        scheduleLabel: formatSchedule(t.scheduledStart),
      })),
    [tests]
  );

  const filtered = useMemo(() => {
    return displayTests.filter((t) => {
      const matchType = !typeFilter || t.type === typeFilter;
      const matchStatus = !statusFilter || t.status.toLowerCase() === statusFilter.toLowerCase();
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [displayTests, typeFilter, statusFilter, search]);

  if (loading) {
    return (
      <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
        <LoadingState label="Loading tests…" />
      </PortalLayout>
    );
  }
  if (error) {
    return (
      <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
        <ErrorState message={error} onRetry={() => load(true)} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="space-y-6 font-sans">
        {/* Header with Title & Action */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">
              Test Management
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Create, configure, schedule and launch assessments.
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-medium text-slate-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live · auto-refreshes every 15s
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/staff/tests/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-brand-500/20 hover:bg-brand-600 transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Create New Test
          </button>
        </div>

        {/* Filter Bar & Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3.5 border-b border-slate-100 p-4 bg-slate-50/50">
            <div className="w-full sm:w-44 max-w-full">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="MIXED">Mixed</option>
                <option value="QUIZ">Quiz</option>
                <option value="MCQ">MCQ</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="FILL_BLANK">Fill in Blank</option>
                <option value="OUTPUT">Output</option>
                <option value="CODE_COMPLETION">Code Completion</option>
                <option value="DEBUGGING">Debugging</option>
                <option value="CODING">Programming</option>
              </select>
            </div>

            <div className="w-full sm:w-44 max-w-full">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search tests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs sm:text-sm font-medium text-slate-700 placeholder-slate-400 focus:border-brand-500 focus:outline-none"
              />
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
            {(search || typeFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('');
                  setStatusFilter('');
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 w-12">#</th>
                  <th className="px-5 py-3.5">Test Name</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5 text-center">Questions</th>
                  <th className="px-5 py-3.5 text-center">Duration</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Start Time</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {tests.length === 0 ? (
                        <EmptyState
                          title="No tests yet"
                          description="Get started by creating your first assessment."
                          action={
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate('/staff/tests/new')}
                            >
                              Create test
                            </Button>
                          }
                        />
                      ) : (
                        <EmptyState
                          title="No matches"
                          description="No tests match your current filters. Try adjusting your search or filters."
                          action={
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSearch('');
                                setTypeFilter('');
                                setStatusFilter('');
                              }}
                            >
                              Clear filters
                            </Button>
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-mono font-medium text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-4 font-bold text-navy-900">{row.name}</td>
                      <td className="px-5 py-4 text-slate-600">{row.typeLabel}</td>
                      <td className="px-5 py-4 text-center font-bold text-navy-800">{row.questionCount}</td>
                      <td className="px-5 py-4 text-center text-slate-600">{row.durationMinutes} min</td>
                      <td className="px-5 py-4">{statusBadge(row.status)}</td>
                      <td className="px-5 py-4 text-slate-600 font-medium">{row.scheduleLabel}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startTest(row)}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              isStartableNow(row)
                                ? 'Start test'
                                : row.scheduledStart
                                  ? `Starts ${row.scheduleLabel}`
                                  : 'Start now — no schedule needed'
                            }
                            disabled={!['DRAFT', 'SCHEDULED'].includes(row.status) || !isStartableNow(row)}
                          >
                            <PlayIcon className="h-4 w-4 fill-emerald-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/staff/tests/${row.id}`)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
                            title="Open test workspace"
                          >
                            <ArrowRightIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTest(row)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Archive"
                            disabled={!['DRAFT', 'SCHEDULED'].includes(row.status)}
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}