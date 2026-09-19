import React, { useCallback, useEffect, useState } from 'react';
import { DownloadIcon, EyeIcon, EyeOffIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { staffNav } from './staffNav';
import { api } from '../../services/api';
import { downloadCsv, toCsv } from '../../utils/csv';
import { formatClock, formatDateTime } from '../../utils/format';

export function StaffResults() {
  const [results, setResults] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [filters, setFilters] = useState({ testId: '', status: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div>
          <p className="font-medium text-navy-800">{row.studentName}</p>
          <p className="font-mono text-xs text-slate-500">{row.studentId}</p>
        </div>

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
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-800">Results</h1>
            <p className="mt-1 text-sm text-slate-600">
              Scores are calculated and stored by the server at submission time.
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
    </PortalLayout>);

}