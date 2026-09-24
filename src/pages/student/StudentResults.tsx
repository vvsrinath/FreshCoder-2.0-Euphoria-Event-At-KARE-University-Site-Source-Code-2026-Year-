import React, { useCallback, useEffect, useState } from 'react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { studentNav } from './studentNav';
import { api } from '../../services/api';
import { formatClock, formatDateTime } from '../../utils/format';
import type { Result } from '../../types';

interface ReviewRow {
  questionId: string;
  type: string;
  marks: number;
  awarded: number;
  correct: boolean | null;
  given: string;
  overridden: boolean;
}

export function StudentResults() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewRow[]>>({});
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

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

  const toggleReview = async (resultId: string) => {
    if (expandedId === resultId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(resultId);
    setReviewError(null);
    if (reviews[resultId]) return;
    setReviewLoading(resultId);
    try {
      const res = await api.result(resultId);
      setReviews((prev) => ({ ...prev, [resultId]: res.result.breakdown ?? [] }));
    } catch (err) {
      setReviewError((err as Error).message);
    } finally {
      setReviewLoading(null);
    }
  };

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

              <div className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleReview(result.id)}
                  className="inline-flex items-center gap-1.5 px-5 py-3 text-xs font-bold text-brand-600 hover:text-brand-700"
                >
                  {expandedId === result.id ? 'Hide' : 'View'} per-question review
                  <svg className={`h-3.5 w-3.5 transition-transform ${expandedId === result.id ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>

                {expandedId === result.id && (
                  <div className="pb-4 px-5">
                    {reviewLoading === result.id ? (
                      <div className="py-4 text-xs text-slate-500">Loading question-by-question marks…</div>
                    ) : reviews[result.id] ? (
                      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                        {reviews[result.id].map((q, i) => {
                          const pending = q.correct === null;
                          const unanswered = q.correct === false && !(q.given ?? '').trim();
                          const correct = q.correct === true;
                          return (
                            <li key={q.questionId} className="flex items-center justify-between gap-4 px-4 py-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="text-sm font-bold text-slate-700">Q{i + 1}</span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                    pending
                                  ? 'bg-sky-100 text-sky-700'
                                  : correct
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : unanswered
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {pending ? 'Pending review' : correct ? 'Correct' : unanswered ? 'Unanswered' : 'Wrong'}
                                </span>
                                {q.overridden && (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                                    Reviewed by examiner
                                  </span>
                                )}
                                {q.given && (
                                  <span className="hidden sm:block truncate text-xs text-slate-500">{q.given}</span>
                                )}
                              </div>
                              <span className="shrink-0 text-sm font-semibold tabular-nums text-navy-800">
                                {q.awarded}/{q.marks}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : reviewError ? (
                      <p className="py-2 text-xs font-semibold text-red-600">{reviewError}</p>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
        )
        }
      </div>
    </PortalLayout>);

}