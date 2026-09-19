import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { studentNav } from './studentNav';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/format';
import { testTypeLabels } from '../../services/evaluation';

export function MyTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.
    studentDashboard().
    then((res) => {
      setTests(res.tests);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const columns: Column<any>[] = [
  {
    key: 'name',
    header: 'Test',
    render: (row) =>
    <div>
          <p className="font-semibold text-navy-800">{row.name}</p>
          <p className="text-xs text-slate-500">{testTypeLabels[row.type] ?? row.type}</p>
        </div>

  },
  { key: 'questions', header: 'Questions', render: (row) => row.questionCount, align: 'center' },
  { key: 'duration', header: 'Duration', render: (row) => `${row.durationMinutes} min`, align: 'center' },
  { key: 'start', header: 'Scheduled', render: (row) => formatDateTime(row.scheduledStart) },
  { key: 'test-status', header: 'Test status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'attempt', header: 'Your attempt', render: (row) => <StatusBadge status={row.attemptStatus} /> },
  {
    key: 'action',
    header: '',
    align: 'right',
    render: (row) =>
    ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(row.attemptStatus) ?
    <Button variant="secondary" size="sm" onClick={() => navigate('/student/results')}>
            Result
          </Button> :

    <Button size="sm" onClick={() => navigate(`/student/tests/${row.id}/waiting`)}>
            Enter
          </Button>

  }];


  return (
    <PortalLayout portalLabel="Student Portal" navItems={studentNav}>
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-2xl font-bold text-navy-800">My tests</h1>
        <Card>
          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={load} /> :

          <DataTable
            columns={columns}
            rows={tests}
            rowKey={(row) => row.id}
            caption="Tests assigned to you"
            empty={<EmptyState title="No tests assigned" description="Check back closer to the event." />} />

          }
        </Card>
      </div>
    </PortalLayout>);

}