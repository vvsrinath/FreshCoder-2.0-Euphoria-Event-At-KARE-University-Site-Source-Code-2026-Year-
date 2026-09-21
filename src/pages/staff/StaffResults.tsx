import React, { useCallback, useEffect, useState } from 'react';
import { DownloadIcon, EyeIcon, EyeOffIcon, SearchIcon } from 'lucide-react';
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
    setDetailLoading(true);
    try {
      const res = await api.result(row.id);
      setSelected(res.result);
    } catch (err) {
      toast.error((err as Error).message);
      setSelected(null);
    } finally {
      setDetailLoading(false);
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
          </div>
        ) : null}
      </Modal>
    </PortalLayout>);

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