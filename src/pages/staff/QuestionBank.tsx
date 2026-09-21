import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Modal } from '../../components/Modal';
import { CodeBlock } from '../../components/CodeBlock';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { QuestionEditor } from './QuestionEditor';
import { staffNav } from './staffNav';
import { api } from '../../services/api';
import type { Question } from '../../types';

const TYPE_LABELS: Record<string, string> = {
  MIXED: 'Mixed',
  MCQ: 'MCQ',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in Blank',
  OUTPUT: 'Output',
  CODE_COMPLETION: 'Code Completion',
  DEBUGGING: 'Debugging',
  CODING: 'Coding',
  QUIZ: 'Quiz',
};

export function QuestionBank() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Question | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<Question | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .questions()
      .then((res) => {
        setQuestions(res.questions);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // Topics available for future use (removed from filter bar for simplicity)

  const deleteQuestion = useCallback(
    async (row: Question) => {
      if (!window.confirm(`Archive ${row.id} — ${row.title}?`)) return;
      try {
        await api.archiveQuestion(row.id);
        toast.success(`Archived ${row.id}`);
        load();
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [load]
  );

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const matchType = !typeFilter || q.type === typeFilter;
      const matchDiff = !difficultyFilter || q.difficulty === difficultyFilter;
      const matchSearch = !search || q.title.toLowerCase().includes(search.toLowerCase()) || q.topic.toLowerCase().includes(search.toLowerCase());
      return matchType && matchDiff && matchSearch;
    });
  }, [questions, typeFilter, difficultyFilter, search]);

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
      <div className="space-y-6 font-sans">
        {/* Header with Title & Action */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-navy-900 tracking-tight">
              Questions
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Your question bank — add via CSV or manual entry, then pick for tests.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Add Question
          </button>
        </div>

        {/* Filter Bar & Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Filters Bar — simplified: 2 dropdowns + search */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 bg-slate-50/50">
            <div className="w-full sm:w-40">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">All Types</option>
                <option value="MCQ">MCQ</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="FILL_BLANK">Fill in Blank</option>
                <option value="OUTPUT">Output</option>
                <option value="CODE_COMPLETION">Code Completion</option>
                <option value="DEBUGGING">Debugging</option>
                <option value="CODING">Coding</option>
              </select>
            </div>

            <div className="w-full sm:w-36">
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">All Levels</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search by title or topic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              />
              <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              {(search || typeFilter || difficultyFilter) && (
                <button type="button" onClick={() => { setSearch(''); setTypeFilter(''); setDifficultyFilter(''); }} className="absolute right-3 top-2.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">Clear</button>
              )}
            </div>
          </div>

          {/* Questions Table — simplified: 4 columns */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-400">Loading questions…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={questions.length === 0 ? 'No questions yet' : 'No matches'}
                description={
                  questions.length === 0
                    ? 'Get started by adding your first question.'
                    : 'No questions match your current filters. Try adjusting your search or filters.'
                }
                action={
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setEditing(null);
                        setEditorOpen(true);
                      }}
                    >
                      Add Question
                    </Button>
                    {(search || typeFilter || difficultyFilter) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                          setTypeFilter('');
                          setDifficultyFilter('');
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                }
              />
            ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 w-14">#</th>
                  <th className="px-5 py-3">Question</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Category</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-500">{row.id}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-navy-900 leading-tight">{row.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500">{row.topic || 'General'}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="font-semibold text-slate-600">{row.marks} pts</span>
                      </p>
                      <span className="mt-1.5 inline-flex sm:hidden rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{TYPE_LABELS[row.type] ?? row.type}</span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-slate-600">{TYPE_LABELS[row.type] ?? row.type}</span>
                        {row.difficulty === 'EASY' ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">Easy</span>
                        ) : row.difficulty === 'MEDIUM' ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">Medium</span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">Hard</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => setPreview(row)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition-colors" title="View"><EyeIcon className="h-4 w-4" /></button>
                        <button type="button" onClick={() => { setEditing(row); setEditorOpen(true); }} className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition-colors" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deleteQuestion(row)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Archive"><Trash2Icon className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 p-4">
            <span className="text-xs text-slate-400 font-medium">
              Showing {filtered.length} of {questions.length} questions
            </span>
          </div>
        </div>
      </div>

      <QuestionEditor
        open={editorOpen}
        question={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={load}
      />

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
        size="lg"
      >
        {preview ? (
          <div className="space-y-4">
            <p className="text-sm text-navy-800">{preview.prompt}</p>
            {preview.code ? <CodeBlock code={preview.code} /> : null}
          </div>
        ) : null}
      </Modal>
    </PortalLayout>
  );
}