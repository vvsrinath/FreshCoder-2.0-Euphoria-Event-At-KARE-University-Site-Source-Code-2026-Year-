import React from 'react';
import { FlagIcon, LockIcon } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { cn } from '../utils/cn';
import { questionTypeLabels } from '../services/evaluation';

export interface ExamQuestion {
  id: string;
  type: string;
  title: string;
  marks: number;
  prompt: string;
  code?: string;
  options?: string[];
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  sampleInput?: string;
  sampleOutput?: string;
}

interface QuestionCardProps {
  index: number;
  question: ExamQuestion;
  value: string;
  locked: boolean;
  editGranted: boolean;
  flagged: boolean;
  onChange: (value: string) => void;
  onToggleFlag: () => void;
}

export function QuestionCard({
  index,
  question,
  value,
  locked,
  editGranted,
  flagged,
  onChange,
  onToggleFlag,
}: QuestionCardProps) {
  const readOnly = locked && !editGranted;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      {/* Header with Badges & Flag */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-extrabold text-navy-900">Question {index + 1}</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200">
            {questionTypeLabels[question.type] ?? question.type}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            {question.marks} {question.marks === 1 ? 'Mark' : 'Marks'}
          </span>
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
              <LockIcon className="h-3 w-3" /> Locked
            </span>
          ) : null}
          {editGranted ? (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
              Edit Approved
            </span>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 hover:text-navy-900 transition-colors select-none">
          <input
            type="checkbox"
            checked={flagged}
            onChange={onToggleFlag}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <FlagIcon className={cn('h-3.5 w-3.5', flagged ? 'text-orange-500 fill-orange-500' : 'text-slate-400')} />
          Flag for Review
        </label>
      </header>

      {/* Question Prompt */}
      <p className="mt-5 text-base sm:text-lg font-medium leading-relaxed text-slate-800">
        {question.prompt}
      </p>

      {/* Code Snippet */}
      {question.code ? (
        <div className="mt-5 rounded-xl overflow-hidden border border-slate-200">
          <CodeBlock code={question.code} />
        </div>
      ) : null}

      {/* Coding Metadata if applicable */}
      {question.type === 'CODING' ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['Input format', question.inputFormat],
            ['Output format', question.outputFormat],
            ['Constraints', question.constraints],
          ]
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <div key={label as string} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm text-navy-900">{v}</dd>
              </div>
            ))}
          {question.sampleInput ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Sample input</dt>
              <dd className="mt-1 font-mono text-sm text-navy-900">{question.sampleInput}</dd>
            </div>
          ) : null}
          {question.sampleOutput ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Sample output</dt>
              <dd className="mt-1 font-mono text-sm text-navy-900">{question.sampleOutput}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {/* Answer Input Controls */}
      <div className="mt-6">
        {question.type === 'MCQ' && question.options ? (
          <fieldset disabled={readOnly}>
            <legend className="sr-only">Select one option</legend>
            <div className="space-y-2.5">
              {question.options.map((option, i) => (
                <label
                  key={option}
                  className={cn(
                    'flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 text-sm font-medium transition-all duration-150',
                    value === String(i)
                      ? 'border-blue-500 bg-blue-50/70 text-navy-900 ring-1 ring-blue-500 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50',
                    readOnly && 'cursor-not-allowed opacity-70'
                  )}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={value === String(i)}
                    onChange={() => onChange(String(i))}
                    className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : question.type === 'TRUE_FALSE' ? (
          <fieldset disabled={readOnly} className="flex gap-4">
            <legend className="sr-only">Select true or false</legend>
            {['true', 'false'].map((option) => (
              <label
                key={option}
                className={cn(
                  'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border p-4 text-sm font-bold capitalize transition-all duration-150',
                  value === option
                    ? 'border-blue-500 bg-blue-50/70 text-navy-900 ring-1 ring-blue-500 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                  readOnly && 'cursor-not-allowed opacity-70'
                )}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={value === option}
                  onChange={() => onChange(option)}
                  className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {option}
              </label>
            ))}
          </fieldset>
        ) : question.type === 'CODING' || question.type === 'DEBUGGING' ? (
          <div>
            <label htmlFor={`answer-${question.id}`} className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Type your answer here...
            </label>
            <textarea
              id={`answer-${question.id}`}
              rows={question.type === 'CODING' ? 10 : 4}
              value={value}
              readOnly={readOnly}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Type your answer here..."
              className={cn(
                'w-full rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm text-navy-900 shadow-xs',
                'transition-all duration-150 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100',
                readOnly && 'cursor-not-allowed bg-slate-50 text-slate-500'
              )}
            />
          </div>
        ) : (
          <div>
            <label htmlFor={`answer-${question.id}`} className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Your Answer
            </label>
            <input
              id={`answer-${question.id}`}
              type="text"
              value={value}
              readOnly={readOnly}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Type your answer here..."
              className={cn(
                'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-sm text-navy-900 shadow-xs',
                'transition-all duration-150 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100',
                readOnly && 'cursor-not-allowed bg-slate-50 text-slate-500'
              )}
            />
          </div>
        )}
      </div>
    </article>
  );
}