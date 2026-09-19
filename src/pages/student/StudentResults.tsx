import React, { useCallback, useEffect, useState } from 'react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { studentNav } from './studentNav';
import { api } from '../../services/api';
import { formatClock, formatDateTime } from '../../utils/format';

export function StudentResults() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.
    studentResults().
    then((res) => {
      setResults(res.results);
      setError(null);
    }).
    catch((err) => setError(err.message)).
    finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <PortalLayout portalLabel="Student Portal" navItems={studentNav}>
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-2xl font-bold text-navy-800">Results</h1>

        {loading ?
        <Card>
            <LoadingState />
          </Card> :
        error ?
        <Card>
            <ErrorState message={error} onRetry={load} />
          </Card> :
        results.length === 0 ?
        <Card>
            <EmptyState
            title="No published results yet"
            description="Results become visible once examination staff publish them." />
          
          </Card> :

        results.map((result) =>
        <Card key={result.id}>
              <CardHeader
            title={result.testName}
            description={`Submitted ${formatDateTime(result.submittedAt)}`}
            action={
            <div className="text-right">
                    <p className="text-2xl font-bold text-navy-800">
                      {result.score}
                      <span className="text-base font-medium text-slate-400">/{result.maxScore}</span>
                    </p>
                    <p className="text-xs font-semibold text-emerald-600">{result.percentage}%</p>
                  </div>
            } />
          
              <dl className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-6">
                {[
            ['Questions', result.totalQuestions],
            ['Attempted', result.attempted],
            ['Correct', result.correct],
            ['Wrong', result.wrong],
            ['Unanswered', result.unanswered],
            ['Time used', formatClock(result.timeUsedSeconds)]].
            map(([label, value]) =>
            <div key={label as string} className="bg-white px-4 py-3 text-center">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-navy-800">{value}</dd>
                  </div>
            )}
              </dl>
            </Card>
        )
        }
      </div>
    </PortalLayout>);

}