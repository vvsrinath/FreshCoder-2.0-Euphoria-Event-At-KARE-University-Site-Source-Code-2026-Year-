import React, { useCallback, useEffect, useState } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StaffNavFooter, staffNav } from './staffNav';
import { api } from '../../services/api';
import { relativeTime } from '../../utils/format';
import { useLive } from '../../hooks/useLive';

export function EditRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.
    editRequests().
    then((res) => {
      setRequests(res.requests);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLive({ intervalMs: 10000, onEvent: () => load(), channel: 'staff-editrequests' });

  const decide = async (requestId: string, approve: boolean) => {
    try {
      if (approve) await api.approveEditRequest(requestId);else
      await api.denyEditRequest(requestId);
      toast.success(approve ? 'Modification approved' : 'Modification denied');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
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
  {
    key: 'question',
    header: 'Question',
    render: (row) =>
    <div>
          <p className="font-mono text-xs text-navy-800">{row.questionId}</p>
          <p className="text-xs text-slate-500">{row.questionTitle}</p>
        </div>

  },
  {
    key: 'answer',
    header: 'Current answer',
    render: (row) => <span className="font-mono text-xs">{row.currentAnswer || '—'}</span>
  },
  { key: 'reason', header: 'Reason', render: (row) => row.reason || <span className="text-slate-400">Not given</span> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  { key: 'time', header: 'Raised', render: (row) => relativeTime(row.createdAt) },
  {
    key: 'actions',
    header: 'Actions',
    align: 'right',
    render: (row) =>
    row.status === 'PENDING' ?
    <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="success" icon={<CheckIcon className="h-3.5 w-3.5" />} onClick={() => decide(row.id, true)}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" icon={<XIcon className="h-3.5 w-3.5" />} onClick={() => decide(row.id, false)}>
              Deny
            </Button>
          </div> :

    <span className="text-xs text-slate-500">
            {row.decidedBy} · {relativeTime(row.decidedAt)}
          </span>

  }];


  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">Requests</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Approving grants a one-time edit permission for that question only. The answer re-locks
            once the student saves it.
          </p>
        </div>

        <Card>
          {loading ?
          <LoadingState /> :
          error ?
          <ErrorState message={error} onRetry={load} /> :

          <DataTable
            columns={columns}
            rows={requests}
            rowKey={(row) => row.id}
            caption="Answer modification requests"
            empty={
            <EmptyState
              title="No modification requests"
              description="Requests raised by students during a live test appear here." />

            } />

          }
        </Card>
      </div>
    </PortalLayout>);

}