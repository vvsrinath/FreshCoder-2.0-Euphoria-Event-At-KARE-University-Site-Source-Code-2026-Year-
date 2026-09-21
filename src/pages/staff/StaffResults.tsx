import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3Icon, DownloadIcon, EyeIcon, EyeOffIcon, PrinterIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StaffNavFooter, staffNav } from './staffNav';
import { api } from '../../services/api';
import { downloadCsv, toCsv } from '../../utils/csv';
import { formatClock, formatDateTime } from '../../utils/format';

export function StaffResults() {
  const [results, setResults] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [filters, setFilters] = useState({ testId: '', status: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, number>>({});
  const [savingGrade, setSavingGrade] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.results(filters), api.tests()]).
    then(([res, testRes]) => {
      setResults(res.results);
      setTests(testRes.tests);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, [filters]);

  useEffect(load, [load]);

  const openDetail = async (row: any) => {
    setSelected(row);
    setGradeDrafts({});
    setDetailLoading(true);
    try {
      const res = await api.result(row.id);
      setSelected(res.result);
      const drafts: Record<string, number> = {};
      (res.result.breakdown ?? []).forEach((b: any) => {
        drafts[b.questionId] = Number(b.awarded);
      });
      setGradeDrafts(drafts);
    } catch (err) {
      toast.error((err as Error).message);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveGrade = async () => {
    if (!selected) return;
    const overrides: Record<string, number> = {};
    (selected.breakdown ?? []).forEach((b: any) => {
      const next = Number(gradeDrafts[b.questionId]);
      if (Number.isFinite(next) && next !== Number(b.awarded)) {
        overrides[b.questionId] = Math.max(0, Math.min(next, Number(b.marks)));
      }
    });
    if (Object.keys(overrides).length === 0) {
      toast.error('No changes to save — adjust at least one awarded mark.');
      return;
    }
    setSavingGrade(true);
    try {
      await api.gradeResult(selected.id, overrides);
      toast.success('Marks updated and result recomputed.');
      setSelected(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingGrade(false);
    }
  };

  const publish = async (published: boolean) => {
    if (!filters.testId) {
      toast.error('Select a test before publishing or hiding results.');
      return;
    }
    try {
      await api.publishResults(filters.testId, published);
      toast.success(published ? 'Results published to students' : 'Results hidden from students');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const exportCsv = () => {
    if (results.length === 0) {
      toast.error('There are no results to export.');
      return;
    }
    const csv = toCsv(
      [
      'Student ID',
      'Student Name',
      'Test',
      'Attempted',
      'Correct',
      'Wrong',
      'Unanswered',
      'Score',
      'Percentage',
      'Time Used',
      'Submission Time',
      'Status'],

      results.map((r) => [
      r.studentId,
      r.studentName,
      r.testName,
      r.attempted,
      r.correct,
      r.wrong,
      r.unanswered,
      `${r.score}/${r.maxScore}`,
      `${r.percentage}%`,
      formatClock(r.timeUsedSeconds),
      formatDateTime(r.submittedAt),
      r.attemptStatus]
      )
    );
    downloadCsv(`fresh-coders-results-${Date.now()}.csv`, csv);
    toast.success(`Exported ${results.length} results`);
  };

  const openAnalytics = async () => {
    if (!filters.testId) {
      toast.error('Select a test before loading its analytics.');
      return;
    }
    setAnalyticsLoading(true);
    try {
      const res = await api.analytics(filters.testId);
      setAnalytics(res);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const columns: Column<any>[] = [
  {
    key: 'student',
    header: 'Student',
    render: (row) =>
    <button
      type="button"
      onClick={() => openDetail(row)}
      title="View result detail"
      className="text-left">
          <p className="font-medium text-navy-800 underline-offset-2 hover:underline">{row.studentName}</p>
          <p className="font-mono text-xs text-slate-500">{row.studentId}</p>
        </button>

  },
  { key: 'test', header: 'Test', render: (row) => row.testName },
  { key: 'attempted', header: 'Attempted', render: (row) => `${row.attempted}/${row.totalQuestions}`, align: 'center' },
  { key: 'correct', header: 'Correct', render: (row) => row.correct, align: 'center' },
  { key: 'wrong', header: 'Wrong', render: (row) => row.wrong, align: 'center' },
  {
    key: 'score',
    header: 'Score',
    align: 'center',
    render: (row) =>
    <span className="font-semibold text-navy-800">
          {row.score}/{row.maxScore}
        </span>

  },
  { key: 'pct', header: '%', render: (row) => `${row.percentage}%`, align: 'center' },
  { key: 'time', header: 'Time used', render: (row) => formatClock(row.timeUsedSeconds) },
  { key: 'submitted', header: 'Submitted', render: (row) => formatDateTime(row.submittedAt) },
  {
    key: 'published',
    header: 'Visibility',
    render: (row) => <StatusBadge status={row.published ? 'PUBLISHED' : 'HIDDEN'} />
  }];


  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">Results</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Click a student to view their result. Scores are stored by the server at submission time.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<BarChart3Icon className="h-4 w-4" />} onClick={openAnalytics} loading={analyticsLoading} disabled={!filters.testId}>
              Item analysis
            </Button>
            <Button variant="secondary" icon={<PrinterIcon className="h-4 w-4" />} onClick={() => window.print()} disabled={!analytics}>
              Print report
            </Button>
            <Button variant="secondary" icon={<EyeOffIcon className="h-4 w-4" />} onClick={() => publish(false)}>
              Hide
            </Button>
            <Button variant="success" icon={<EyeIcon className="h-4 w-4" />} onClick={() => publish(true)}>
              Publish
            </Button>
            <Button icon={<DownloadIcon className="h-4 w-4" />} onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
            <div className="w-56">
              <SelectField
                label="Test"
                value={filters.testId}
                onChange={(e) => setFilters({ ...filters, testId: e.target.value })}
                options={[
                { value: '', label: 'All tests' },
                ...tests.map((t) => ({ value: t.id, label: t.name }))]
                } />
              
            </div>
            <div className="w-44">
              <SelectField
                label="Visibility"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                options={[
                { value: '', label: 'All' },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'HIDDEN', label: 'Hidden' }]
                } />
              
            </div>
            <div className="w-60">
              <TextField
                label="Search"
                placeholder="Student ID or name…"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                icon={<SearchIcon className="h-4 w-4" />} />
              
            </div>
          </div>

          {!loading && !error && results.length > 0 ? <ScoreHistogram results={results} /> : null}

          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={load} /> :

          <DataTable
            columns={columns}
            rows={results}
            rowKey={(row) => row.id}
            dense
            caption="Results"
            empty={
            <EmptyState
              title="No results yet"
              description="Results appear as soon as students submit their attempts." />

            } />

          }
        </Card>
      </div>

      {analytics && (
        <Card className="scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold text-navy-900 dark:text-white">Item analysis & cohort report</h2>
              <p className="text-xs text-slate-500">Difficulty = share of attempts correct · Discrimination = mean % of students who answered correctly minus mean % of those who missed it.</p>
            </div>
            <Button variant="secondary" size="sm" icon={<PrinterIcon className="h-4 w-4" />} onClick={() => window.print()}>
              Print report
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-black/5 p-4 sm:grid-cols-4 dark:border-white/10">
            <DetailStat label="Submissions" value={analytics.summary.submitted} tone="text-navy-900" />
            <DetailStat label="Average" value={`${analytics.summary.avgPercentage}%`} tone="text-brand-600" />
            <DetailStat label="Median" value={`${analytics.summary.medianScore} pts`} tone="text-navy-900" />
            <DetailStat label="Published" value={analytics.summary.published} tone="text-emerald-600" />
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/10">
                  <th className="py-2 pr-3">Question</th>
                  <th className="py-2 pr-3">Instances</th>
                  <th className="py-2 pr-3">Difficulty</th>
                  <th className="py-2 pr-3">Discrimination</th>
                  <th className="py-2 pr-3">Correct</th>
                  <th className="py-2 pr-3">Avg awarded</th>
                </tr>
              </thead>
              <tbody>
                {analytics.perQuestion.map((q: any, i: number) => (
                  <tr key={q.questionId} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                    <td className="max-w-64 truncate py-2 pr-3 font-medium text-navy-800 dark:text-white">
                      Q{i + 1} · {q.title}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{q.instances}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">
                      {q.difficultyIndex < 0.3 ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Hard</span>
                      ) : q.difficultyIndex > 0.8 ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Easy</span>
                      ) : (
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">Mid</span>
                      )}{' '}
                      {q.difficultyIndex}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{q.discrimination === null ? '—' : q.discrimination}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{q.correct}/{q.instances}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-600">{q.avgAwarded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        size="md"
        title="Result detail"
        description={selected ? `${selected.studentName} · ${selected.testName}` : undefined}
      >
        {detailLoading ? (
          <LoadingState label="Loading result…" />
        ) : selected ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailStat label="Score" value={`${selected.score}/${selected.maxScore}`} tone="text-navy-900" />
              <DetailStat label="Percentage" value={`${selected.percentage}%`} tone="text-emerald-600" />
              <DetailStat label="Correct" value={selected.correct} tone="text-emerald-600" />
              <DetailStat label="Wrong" value={selected.wrong} tone="text-red-600" />
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailRow label="Total questions" value={selected.totalQuestions} />
              <DetailRow label="Attempted" value={selected.attempted} />
              <DetailRow label="Unanswered" value={selected.unanswered} />
              <DetailRow label="Time used" value={formatClock(selected.timeUsedSeconds)} />
              <DetailRow label="Attempt status" value={<StatusBadge status={selected.attemptStatus} />} />
              <DetailRow label="Visibility" value={<StatusBadge status={selected.published ? 'PUBLISHED' : 'HIDDEN'} />} />
              <DetailRow label="Submitted" value={formatDateTime(selected.submittedAt)} />
              <DetailRow label="Student ID" value={<span className="font-mono">{selected.studentId}</span>} />
            </dl>

            {Array.isArray(selected.breakdown) && selected.breakdown.length > 0 ? (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
                    Manual grade · rubric overrides
                  </h3>
                  <Button size="sm" loading={savingGrade} onClick={saveGrade} disabled={savingGrade}>
                    Save marks
                  </Button>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Adjust awarded marks per question, including partial credit for written answers. Totals are recomputed on save.
                </p>
                <div className="mt-3 space-y-2">
                  {selected.breakdown.map((b: any, index: number) => {
                    const marks = Number(b.marks);
                    const awarded = Number(gradeDrafts[b.questionId] ?? b.awarded);
                    const changed = awarded !== Number(b.awarded);
                    return (
                      <div
                        key={`${selected.id}-${b.questionId}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-navy-800 dark:text-white">
                            Q{index + 1} · {b.type}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {b.correct ? 'Correct' : b.given ? 'Answered' : 'Unanswered'}
                            {b.overridden || changed ? ' · manually graded' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={marks}
                            step="any"
                            value={String(Number.isFinite(awarded) ? awarded : 0)}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setGradeDrafts((prev) => ({
                                ...prev,
                                [b.questionId]: Number.isNaN(value) ? 0 : value,
                              }));
                            }}
                            className={`w-20 rounded-lg border bg-white px-2 py-1 text-right text-sm font-semibold tabular-nums text-navy-900 dark:bg-navy-900 ${
                              changed
                                ? 'border-amber-400 text-amber-600'
                                : 'border-slate-300 dark:border-white/15'
                            }`}
                          />
                          <span className="text-xs text-slate-400">/ {marks}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {analytics ? (
        <div className="print-report">
          <div className="mb-6 border-b-2 border-black pb-3">
            <h1 className="text-xl font-black text-black">Fresh Coders 2.0 · Euphoria 2026 — Item analysis report</h1>
            <p className="mt-1 text-sm text-gray-700">Test: {tests.find((t) => t.id === filters.testId)?.name ?? filters.testId}</p>
            <p className="text-xs text-gray-500">
              Generated {new Date().toLocaleString()} · {analytics.summary.submitted} submissions · {analytics.summary.published} published
            </p>
          </div>
          <table className="mb-6 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left">Metric</th>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Submissions', String(analytics.summary.submitted)],
                ['Published', String(analytics.summary.published)],
                ['Average score', String(analytics.summary.avgScore)],
                ['Median score', String(analytics.summary.medianScore)],
                ['Max / Min', `${analytics.summary.maxScore} / ${analytics.summary.minScore}`],
                ['Average %', `${analytics.summary.avgPercentage}%`],
                ['Average time', `${Math.round(analytics.summary.avgTimeSeconds / 60)} min`],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="border border-gray-300 px-2 py-1">{label}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className="mb-2 text-base font-bold text-black">Question-level analysis</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left">Question</th>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-right">Instances</th>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-right">Difficulty</th>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-right">Discrimination</th>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-right">Correct</th>
                <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-right">Avg awarded</th>
              </tr>
            </thead>
            <tbody>
              {analytics.perQuestion.map((q: any, i: number) => (
                <tr key={q.questionId}>
                  <td className="border border-gray-300 px-2 py-1">Q{i + 1} · {q.title}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{q.instances}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{q.difficultyIndex}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{q.discrimination === null ? '—' : q.discrimination}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{q.correct}/{q.instances}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right tabular-nums">{q.avgAwarded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PortalLayout>);

}

function ScoreHistogram({ results }: { results: any[] }) {
  if (results.length === 0) return null;

  const buckets = Array.from({ length: 10 }, (_, i) => ({ low: i * 10, high: i * 10 + 10, count: 0 }));
  let sum = 0;
  for (const r of results) {
    const pct = Number(r.percentage) || 0;
    sum += pct;
    buckets[Math.min(9, Math.floor(pct / 10))].count += 1;
  }
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const average = Math.round((sum / results.length) * 10) / 10;

  return (
    <div className="border-b border-black/5 px-6 py-5 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">Score distribution</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {results.length} attempts · {average}% average
        </p>
      </div>
      <div className="mt-6 flex h-32 items-end gap-1.5 sm:gap-2">
        {buckets.map((b, i) => {
          const pct = b.count === 0 ? 4 : Math.round((b.count / max) * 100);
          return (
            <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end">
              <div
                className="relative w-full max-w-9 rounded-t-md bg-black/10 transition-colors group-hover:bg-brand-500/80 dark:bg-white/10"
                style={{ height: `${pct}%` }}
                title={`${b.low}–${b.high === 100 ? 100 : b.high}%: ${b.count} attempts`}
              >
                {b.count > 0 ? (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {b.count}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-2 dark:border-white/10">
        <span className="text-[10px] font-medium text-slate-400">0%</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">Buckets of 10%</span>
        <span className="text-[10px] font-medium text-slate-400">100%</span>
      </div>
    </div>
  );
}

function DetailStat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-center">
      <p className={`text-xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm font-bold text-navy-900">{value}</dd>
    </div>
  );
}