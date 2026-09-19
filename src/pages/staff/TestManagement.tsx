import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { staffNav } from './staffNav';
import { api } from '../../services/api';
import type { Test } from '../../types';

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

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  PAUSED: 'bg-amber-50 text-amber-700 border-amber-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  COMPLETED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ARCHIVED: 'bg-red-50 text-red-600 border-red-200',
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
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
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

  const load = useCallback(() => {
    setLoading(true);
    api
      .tests()
      .then((res) => {
        setTests(res.tests);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

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
      const matchType = !typeFilter || t.typeLabel.toLowerCase().includes(typeFilter.toLowerCase());
      const matchStatus = !statusFilter || t.status.toLowerCase() === statusFilter.toLowerCase();
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [displayTests, typeFilter, statusFilter, search]);

  if (loading) {
    return (
      <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
        <LoadingState label="Loading tests…" />
      </PortalLayout>
    );
  }
  if (error) {
    return (
      <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
        <ErrorState message={error} onRetry={load} />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
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
          </div>
          <button
            type="button"
            onClick={() => navigate('/staff/tests/new')}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Create New Test
          </button>
        </div>

        {/* Filter Bar & Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3.5 border-b border-slate-100 p-4 bg-slate-50/50">
            <div className="w-36 sm:w-44">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="Mixed">Mixed</option>
                <option value="Debugging">Debugging</option>
                <option value="Fill in Blank">Fill in Blank</option>
                <option value="Programming">Programming</option>
                <option value="Output">Output</option>
              </select>
            </div>

            <div className="w-36 sm:w-44">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs sm:text-sm font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
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
                {filtered.map((row, idx) => (
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
                          title="Start test"
                          disabled={!['DRAFT', 'SCHEDULED'].includes(row.status)}
                        >
                          <PlayIcon className="h-4 w-4 fill-emerald-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/staff/tests/${row.id}/edit`)}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}