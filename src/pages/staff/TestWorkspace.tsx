import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  EyeIcon,
  ListChecksIcon,
  PlayIcon,
  PauseIcon,
  PlusIcon,
  RefreshCwIcon,
  Settings2Icon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { TextAreaField } from '../../components/TextAreaField';
import { SelectField } from '../../components/SelectField';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { StaffNavFooter, staffNav } from './staffNav';
import { api } from '../../services/api';
import { questionTypeLabels, testTypeLabels } from '../../services/evaluation';
import type { Question, Test, TestType } from '../../types';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Live',
  SCHEDULED: 'Scheduled',
  PAUSED: 'Paused',
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-white text-slate-600 border-black/10',
  PAUSED: 'bg-white text-slate-600 border-black/10',
  SCHEDULED: 'bg-white text-slate-600 border-black/10',
  DRAFT: 'bg-white text-slate-600 border-black/10',
  COMPLETED: 'bg-white text-slate-600 border-black/10',
  ARCHIVED: 'bg-white text-slate-600 border-black/10',
};

const DIFFICULTY_LABELS: Record<string, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

function fmt(value: string | null | undefined): string {
  if (!value) return 'Not scheduled';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

type Step = 'details' | 'questions' | 'delivery' | 'preview' | 'live';

const STEPS: { id: Step; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'questions', label: 'Questions' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'preview', label: 'Preview' },
  { id: 'live', label: 'Live' },
];

export function TestWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.test(id), api.testQuestions(id)])
      .then(([testRes, qRes]) => {
        setTest(testRes.test);
        setQuestions(qRes.questions ?? []);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!test) {
    if (loading) {
      return (
        <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
          <LoadingState label="Loading test…" />
        </PortalLayout>
      );
    }
    return (
      <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
        <ErrorState message={error ?? 'Test not found.'} onRetry={reload} />
      </PortalLayout>
    );
  }

  const live = ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(test.status);

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav} navFooter={<StaffNavFooter />}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeftIcon className="h-4 w-4" />}
              onClick={() => navigate('/staff/tests')}
            >
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-navy-900 tracking-tight">{test.name}</h1>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[test.status]}`}>
                  {test.status === 'ACTIVE' ? 'Live' : STATUS_LABELS[test.status]}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {questions.length} questions · {test.durationMinutes} min · {testTypeLabels[test.type] ?? test.type}
              </p>
            </div>
          </div>
          <TestControls test={test} onChanged={reload} />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              disabled={s.id === 'live' && !live && test.status !== 'COMPLETED' && !['ACTIVE', 'PAUSED'].includes(test.status)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-30 ${
                step === s.id ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s.id === 'live' ? <PlayIcon className="h-4 w-4" /> : s.id === 'preview' ? <EyeIcon className="h-4 w-4" /> : <ListChecksIcon className="h-4 w-4" />}
              {s.label}
            </button>
          ))}
        </div>

        {step === 'details' ? (
          <DetailsStep key={test.id} test={test} onSaved={reload} />
        ) : step === 'questions' ? (
          <QuestionsStep key={test.id} test={test} questions={questions} onChanged={reload} />
        ) : step === 'delivery' ? (
          <DeliveryStep key={test.id} test={test} questionCount={questions.length} onSaved={reload} />
        ) : step === 'preview' ? (
          <PreviewStep test={test} questions={questions} onPublish={reload} />
        ) : (
          <LivePanel test={test} onChanged={reload} />
        )}
      </div>
    </PortalLayout>
  );
}

// ---------------------------------------------------------------- controls
function TestControls({ test, onChanged }: { test: Test; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(action);
    try {
      await fn();
      toast.success(message);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const scheduledAt = test.scheduledStart ? new Date(String(test.scheduledStart).replace(' ', 'T')).getTime() : null;
  const startReady = scheduledAt === null || scheduledAt <= Date.now();
  const startHint = scheduledAt === null
    ? undefined
    : !startReady
      ? `This test starts at ${new Date(test.scheduledStart as string).toLocaleString()} and cannot be made live before then.`
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {test.status === 'DRAFT' && (
        <Button
          loading={busy === 'schedule'}
          icon={<CheckCircle2Icon className="h-4 w-4" />}
          onClick={() => run('schedule', () => api.scheduleTest(test.id, test.scheduledStart), 'Test published. Students can see it now.')}
        >
          Publish
        </Button>
      )}
      {(test.status === 'DRAFT' || test.status === 'SCHEDULED') && (
        <Button
          variant="success"
          loading={busy === 'start'}
          disabled={!startReady}
          title={startHint}
          icon={<PlayIcon className="h-4 w-4" />}
          onClick={() => run('start', () => api.startTestAsStaff(test.id), 'Test is now live.')}
        >
          Start test
        </Button>
      )}
      {test.status === 'ACTIVE' && (
        <Button
          variant="secondary"
          loading={busy === 'pause'}
          icon={<PauseIcon className="h-4 w-4" />}
          onClick={() => run('pause', () => api.stopTest(test.id), 'Test paused.')}
        >
          Pause
        </Button>
      )}
      {test.status === 'PAUSED' && (
        <Button
          variant="success"
          loading={busy === 'resume'}
          disabled={!startReady}
          title={startHint}
          icon={<PlayIcon className="h-4 w-4" />}
          onClick={() => run('resume', () => api.startTestAsStaff(test.id), 'Test resumed.')}
        >
          Resume
        </Button>
      )}
      {['ACTIVE', 'PAUSED'].includes(test.status) && (
        <Button
          variant="danger"
          loading={busy === 'force'}
          icon={<CheckCircle2Icon className="h-4 w-4" />}
          onClick={() => run('force', () => api.forceStopTest(test.id), 'Test ended — all live attempts submitted.')}
        >
          End & submit all
        </Button>
      )}
      {['DRAFT', 'SCHEDULED'].includes(test.status) && (
        <Button
          variant="ghost"
          loading={busy === 'archive'}
          icon={<Trash2Icon className="h-4 w-4" />}
          onClick={() => run('archive', () => api.deleteTest(test.id), 'Test archived.')}
        >
          Archive
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- details
function DetailsStep({ test, onSaved }: { test: Test; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: test.name,
    description: test.description,
    type: test.type,
    durationMinutes: test.durationMinutes,
    scheduledStart: test.scheduledStart ? String(test.scheduledStart).slice(0, 16) : '',
    timingReason: '',
  });
  const [saving, setSaving] = useState(false);
  const locked = ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(test.status);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Test name is required.');
      return;
    }
    setSaving(true);
    try {
      await api.updateTest(test.id, {
        name: form.name,
        description: form.description,
        type: form.type,
        durationMinutes: Number(form.durationMinutes),
        scheduledStart: form.scheduledStart || null,
        timingReason: form.timingReason || undefined,
      });
      toast.success('Test details saved.');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Test details" description="Core settings for this assessment." />
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <TextField
          label="Test name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Python Fundamentals"
          required
        />
        <SelectField
          label="Test type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as TestType })}
          options={Object.entries(testTypeLabels).map(([value, label]) => ({ value, label }))}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What does this assessment cover?"
          />
        </div>
        <TextField
          label="Duration (minutes)"
          type="number"
          min={1}
          disabled={locked}
          value={String(form.durationMinutes)}
          onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
          hint={locked ? 'Duration is locked while the test is live.' : undefined}
        />
        <TextField
          label="Scheduled start"
          type="datetime-local"
          value={form.scheduledStart}
          onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
          hint="Students wait in the waiting room until staff start the test."
        />
        {!locked && Number(form.durationMinutes) !== test.durationMinutes ? (
          <div className="md:col-span-2">
            <TextField
              label="Reason for timing change"
              value={form.timingReason}
              onChange={(e) => setForm({ ...form, timingReason: e.target.value })}
              placeholder={`${test.durationMinutes} → ${form.durationMinutes} minutes`}
              hint="Timing changes are recorded in the audit log with your staff ID."
            />
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 md:col-span-2">
          <Button loading={saving} onClick={save}>
            Save details
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- questions
const CSV_HINT = [
  'Columns (header row optional):',
  'question, type, marks, topic, difficulty, option_a, option_b, option_c, option_d, correct_answer, keywords, expected_output, explanation',
  'Types: MCQ, TRUE_FALSE, FILL_BLANK, OUTPUT, CODE_COMPLETION, DEBUGGING, CODING',
  'MCQ correct_answer accepts A–D or the option text. TRUE_FALSE accepts true/false.',
  '',
  'Separate fields with a tab or comma. One question per line.',
].join('\n');

function QuestionsStep({
  test,
  questions,
  onChanged,
}: { test: Test; questions: Question[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Question | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const locked = ['ACTIVE', 'PAUSED'].includes(test.status);

  const totalMarks = questions.reduce((s, q) => s + (q.marks ?? 0), 0);

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const reordered = [...questions];
    const [item] = reordered.splice(index, 1);
    reordered.splice(target, 0, item);
    try {
      await api.reorderTestQuestions(test.id, reordered.map((q) => q.id));
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
      onChanged();
    }
  };

  const remove = async (q: Question) => {
    try {
      await api.archiveQuestion(q.id);
      toast.success(`Removed ${q.title}`);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-navy-900">Questions for this test</h2>
          <p className="text-xs font-medium text-slate-500">
            {questions.length} questions · {totalMarks} total marks · these only (no bank pool)
          </p>
        </div>
        {!locked ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<UploadIcon className="h-4 w-4" />}
              onClick={() => setImportOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              size="sm"
              icon={<PlusIcon className="h-4 w-4" />}
              onClick={() => {
                setEditing(null);
                setAddOpen(true);
              }}
            >
              Add question
            </Button>
          </div>
        ) : null}
      </div>

      {questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Add questions one by one or import them from a CSV file."
          action={
            !locked ? (
              <Button size="sm" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                Add your first question
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-sm font-semibold text-slate-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-navy-900">{q.title}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                      {questionTypeLabels[q.type] ?? q.type}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                      {DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
                      {q.marks} mark{q.marks === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{q.prompt}</p>
                </div>
                {!locked ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton title="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUpIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title="Move down"
                      disabled={index === questions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title="Edit"
                      onClick={() => {
                        setEditing(q);
                        setAddOpen(true);
                      }}
                    >
                      <Settings2Icon className="h-4 w-4" />
                    </IconButton>
                    <IconButton title="Remove" danger onClick={() => remove(q)}>
                      <Trash2Icon className="h-4 w-4" />
                    </IconButton>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen ? (
        <TestQuestionForm
          open={addOpen}
          testId={test.id}
          question={editing}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            onChanged();
          }}
        />
      ) : null}
      {importOpen ? (
        <ImportCsvModal
          testId={test.id}
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function IconButton({
  title,
  onClick,
  children,
  disabled,
  danger = false,
}: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-1.5 transition-colors disabled:opacity-30 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- test question form
function TestQuestionForm({
  open,
  testId,
  question,
  onClose,
  onSaved,
}: { open: boolean; testId: string; question: Question | null; onClose: () => void; onSaved: () => void }) {
  const blank = {
    title: '',
    type: 'MCQ' as Question['type'],
    topic: 'Basics',
    difficulty: 'EASY',
    marks: 1,
    prompt: '',
    code: '',
    options: ['', '', '', ''],
    answer: '0',
    alternatives: '',
    explanation: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    sampleInput: '',
    sampleOutput: '',
  };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (question) {
      setForm({
        ...blank,
        ...question,
        code: question.code ?? '',
        options: question.options ?? ['', '', '', ''],
        alternatives: (question.alternatives ?? []).join(', '),
        explanation: question.explanation ?? '',
      });
    } else {
      setForm({ ...blank });
    }
  }, [question, open]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.prompt.trim()) {
      toast.error('Question text is required.');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim() || form.prompt.trim().slice(0, 80),
      type: form.type,
      topic: form.topic,
      difficulty: form.difficulty,
      marks: Number(form.marks),
      question: form.prompt,
      code: form.code || undefined,
      options: form.type === 'MCQ' && form.options.some((o) => o.trim())
        ? form.options.filter((o) => o.trim())
        : undefined,
      answer: form.answer,
      alternatives: form.alternatives
        ? form.alternatives.split(',').map((a) => a.trim()).filter(Boolean)
        : undefined,
      explanation: form.explanation || undefined,
      inputFormat: form.inputFormat || undefined,
      outputFormat: form.outputFormat || undefined,
      constraints: form.constraints || undefined,
      sampleInput: form.sampleInput || undefined,
      sampleOutput: form.sampleOutput || undefined,
    };
    try {
      if (question) {
        await api.updateQuestion(question.id, payload);
      } else {
        await api.addTestQuestion(testId, payload);
      }
      toast.success(question ? 'Question updated' : 'Question added to this test');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={question ? `Edit ${question.id}` : 'Add question to this test'}
      description="Questions are unique to this test."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {question ? 'Save question' : 'Add question'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <TextField label="Title (optional)" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Defaults to question text" />
          </div>
          <SelectField
            label="Type"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            options={Object.entries(questionTypeLabels).map(([value, label]) => ({ value, label }))}
          />
          <TextField label="Topic" value={form.topic} onChange={(e) => set('topic', e.target.value)} />
          <SelectField
            label="Difficulty"
            value={form.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            options={[
              { value: 'EASY', label: 'Easy' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HARD', label: 'Hard' },
            ]}
          />
          <TextField label="Marks" type="number" min={1} value={String(form.marks)} onChange={(e) => set('marks', Number(e.target.value))} />
        </div>

        <TextAreaField label="Question text" rows={3} value={form.prompt} onChange={(e) => set('prompt', e.target.value)} />

        {['FILL_BLANK', 'OUTPUT', 'CODE_COMPLETION', 'DEBUGGING'].includes(form.type) ? (
          <TextAreaField
            label="Code block"
            mono
            rows={5}
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="Python code shown with the question"
          />
        ) : null}

        {form.type === 'MCQ' ? (
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-navy-700">Options and correct answer</legend>
            {form.options.map((option, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct-option"
                  aria-label={`Mark option ${index + 1} correct`}
                  checked={form.answer === String(index)}
                  onChange={() => set('answer', String(index))}
                  className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <input
                  type="text"
                  value={option}
                  aria-label={`Option ${index + 1}`}
                  onChange={(e) => {
                    const next = [...form.options];
                    next[index] = e.target.value;
                    set('options', next);
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            ))}
          </fieldset>
        ) : form.type === 'TRUE_FALSE' ? (
          <SelectField
            label="Correct answer"
            value={form.answer}
            onChange={(e) => set('answer', e.target.value)}
            options={[
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' },
            ]}
          />
        ) : form.type === 'CODING' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextAreaField label="Input format" rows={2} value={form.inputFormat} onChange={(e) => set('inputFormat', e.target.value)} />
            <TextAreaField label="Output format" rows={2} value={form.outputFormat} onChange={(e) => set('outputFormat', e.target.value)} />
            <TextAreaField label="Constraints" rows={2} value={form.constraints} onChange={(e) => set('constraints', e.target.value)} />
            <TextField label="Sample input" value={form.sampleInput} onChange={(e) => set('sampleInput', e.target.value)} />
            <TextField label="Sample output" value={form.sampleOutput} onChange={(e) => set('sampleOutput', e.target.value)} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Expected answer" value={form.answer} onChange={(e) => set('answer', e.target.value)} />
            <TextField
              label="Alternative answers"
              value={form.alternatives}
              onChange={(e) => set('alternatives', e.target.value)}
              hint="Comma separated. Compared after normalisation."
            />
          </div>
        )}

        <TextAreaField label="Explanation" rows={2} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- import csv
function ImportCsvModal({
  testId,
  onClose,
  onSaved,
}: { testId: string; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const splitCell = (cell: string) => cell.trim().replace(/^["']|["']$/g, '');
  const parseRows = () => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: Record<string, string>[] = [];
    lines.forEach((line) => {
      const separator = line.includes('\t') ? '\t' : ',';
      const cells = line.split(separator).map(splitCell);
      const hasHeader = cells.some((c) => /^(question|type|marks|prompt)$/i.test(c));
      if (hasHeader) return;
      rows.push({
        question: cells[0] ?? '',
        type: cells[1] ?? '',
        marks: cells[2] ?? '1',
        topic: cells[3] ?? '',
        difficulty: cells[4] ?? '',
        option_a: cells[5] ?? '',
        option_b: cells[6] ?? '',
        option_c: cells[7] ?? '',
        option_d: cells[8] ?? '',
        correct_answer: cells[9] ?? '',
        keywords: cells[10] ?? '',
        expected_output: cells[11] ?? '',
        explanation: cells[12] ?? '',
      });
    });
    return rows;
  };

  const save = async () => {
    const rows = parseRows();
    if (rows.length === 0) {
      toast.error('No question rows found. Paste one question per line.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.importTestQuestions(testId, rows);
      if ((res.errors ?? []).length > 0) {
        toast.warning(`Imported ${res.imported}. ${res.errors.length} row(s) skipped.`);
        (res.errors as { line: number; message: string }[]).forEach((e) =>
          toast.error(`Row ${e.line}: ${e.message}`)
        );
      } else {
        toast.success(`Imported ${res.imported} question(s).`);
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Import questions from CSV"
      description="Tab or comma separated. The header row is optional."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} icon={<DownloadIcon className="h-4 w-4" />} onClick={save}>
            Import
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextAreaField
          label="CSV / TSV content"
          mono
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Python list comprehension\tMCQ\t1\tBasics\tEASY\ta: [1,2]\tb: [0,1,2]\t\t\tA\t\t\t'}
        />
        <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">{CSV_HINT}</pre>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- delivery
function DeliveryStep({
  test,
  questionCount,
  onSaved,
}: { test: Test; questionCount: number; onSaved: () => void }) {
  const [mode, setMode] = useState<'MANUAL' | 'RANDOM'>(test.selectionMode === 'MANUAL' ? 'MANUAL' : 'RANDOM');
  const [perStudent, setPerStudent] = useState(test.questionCount || questionCount);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (mode === 'RANDOM' && (Number(perStudent) < 1 || Number(perStudent) > questionCount)) {
      toast.error(`Questions per student must be between 1 and ${questionCount}.`);
      return;
    }
    setSaving(true);
    try {
      await api.updateTest(test.id, {
        selectionMode: mode,
        questionCount: mode === 'MANUAL' ? questionCount : Number(perStudent),
        manualQuestionIds: questionCount ? test.manualQuestionIds : [],
      });
      toast.success('Delivery settings saved.');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Delivery"
        description="How students receive the questions in this test."
      />
      <div className="space-y-4 p-5">
        <label
          className={`block cursor-pointer rounded-2xl border-2 p-5 transition-colors ${
            mode === 'MANUAL' ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <input
            type="radio"
            name="delivery"
            className="sr-only"
            checked={mode === 'MANUAL'}
            onChange={() => setMode('MANUAL')}
          />
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ListChecksIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-bold text-navy-900">Same questions for everyone</p>
              <p className="text-xs leading-relaxed text-slate-500">
                All {questionCount} questions are shown to every student in a fixed order — the order you set in the Questions tab.
              </p>
            </div>
          </div>
        </label>

        <label
          className={`block cursor-pointer rounded-2xl border-2 p-5 transition-colors ${
            mode === 'RANDOM' ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <input
            type="radio"
            name="delivery"
            className="sr-only"
            checked={mode === 'RANDOM'}
            onChange={() => setMode('RANDOM')}
          />
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <RefreshCwIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="font-bold text-navy-900">Randomized from this test</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Each student gets a randomized subset in a shuffled order, and MCQ options are re-ordered per student so no two papers are alike.
              </p>
            </div>
          </div>
        </label>

        {mode === 'RANDOM' ? (
          <div className="max-w-sm">
            <TextField
              label="Questions per student"
              type="number"
              min={1}
              max={questionCount}
              value={String(perStudent)}
              onChange={(e) => setPerStudent(Number(e.target.value))}
              hint={`You have ${questionCount} question(s) in this test.`}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button loading={saving} onClick={save}>
            Save delivery
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- preview
function PreviewStep({
  test,
  questions,
  onPublish,
}: { test: Test; questions: Question[]; onPublish: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const publish = async () => {
    setPublishing(true);
    try {
      await api.scheduleTest(test.id, test.scheduledStart);
      toast.success('Test published. It is now listed for students.');
      onPublish();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-navy-900">Preview</h2>
          <p className="text-xs font-medium text-slate-500">
            Review every question and its marking before students see it.
          </p>
        </div>
        {test.status === 'DRAFT' ? (
          <Button
            loading={publishing}
            disabled={!test.scheduledStart}
            title={test.scheduledStart ? undefined : 'Set a scheduled start time (Details step) first.'}
            icon={<CheckCircle2Icon className="h-4 w-4" />}
            onClick={publish}
          >
            Publish test
          </Button>
        ) : (
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-black/10">
            Published
          </span>
        )}
      </div>

      {questions.length === 0 ? (
        <EmptyState title="Nothing to preview" description="Add questions before publishing." />
      ) : (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setExpanded(expanded === index ? null : index)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-sm font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-navy-900">{q.title}</p>
                    <p className="text-xs text-slate-500">{questionTypeLabels[q.type] ?? q.type} · {q.marks} mark{q.marks === 1 ? '' : 's'}</p>
                  </div>
                </div>
                {expanded === index ? (
                  <ChevronUpIcon className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                )}
              </button>
              {expanded === index ? (
                <div className="border-t border-slate-100 p-4">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{q.prompt}</p>
                  {q.code ? <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{q.code}</pre> : null}
                  {q.type === 'MCQ' && q.options ? (
                    <ol className="mt-3 space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <li key={oi} className={`rounded-lg px-3 py-1.5 text-sm ${String(oi) === q.answer ? 'bg-emerald-50 font-bold text-emerald-700' : 'text-slate-600'}`}>
                          {String.fromCharCode(65 + oi)}. {opt} {String(oi) === q.answer ? '✓' : ''}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-emerald-700">
                      Correct answer: {q.answer}
                      {q.alternatives && q.alternatives.length > 0 ? ` (also accepts ${q.alternatives.join(', ')})` : ''}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- live
function LivePanel({ test, onChanged }: { test: Test; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.live({ testId: test.id }).then(setData).catch(() => undefined);
  }, [test.id]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 8000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const act = async (attemptId: string, action: string, fn: () => Promise<unknown>, msg: string) => {
    setActing(attemptId);
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActing(null);
    }
  };

  const stats = data?.stats;
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-navy-900">Live monitoring</h2>
          <p className="text-xs font-medium text-slate-500">
            Refreshes automatically every few seconds.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCwIcon className="h-4 w-4" />} onClick={refresh}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat label="Writing now" value={stats?.active ?? 0} tone="text-emerald-600" />
        <MiniStat label="Submitted" value={stats?.submitted ?? 0} tone="text-navy-900" />
        <MiniStat label="Locked" value={stats?.locked ?? 0} tone="text-amber-500" />
        <MiniStat label="Security flags" value={stats?.securityEvents ?? 0} tone="text-red-600" />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No attempts yet" description="Students will appear here as they start the test." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Progress</th>
                  <th className="px-4 py-3 text-center">Answered</th>
                  <th className="px-4 py-3 text-center">Flags</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r: any) => (
                  <tr key={r.attemptId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-bold text-navy-900">{r.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">{r.studentId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <LiveStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{r.currentQuestion}/{r.totalQuestions}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{r.answered}/{r.totalQuestions}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      <span className={r.securityEvents > 0 ? 'font-bold text-red-600' : 'text-slate-400'}>{r.securityEvents}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LiveRowActions
                        row={r}
                        acting={acting === r.attemptId}
                        onLock={() => act(r.attemptId, 'lock', () => api.lockStudent(r.studentId, 'Locked after a security flag'), 'Student locked')}
                        onUnlock={() => act(r.attemptId, 'unlock', () => api.unlockStudent(r.studentId, 'Issue resolved'), 'Student unlocked')}
                        onForceSubmit={() => act(r.attemptId, 'force', () => api.forceSubmitStudent(r.studentId), 'Attempt submitted')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className={`text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

const LIVE_STATUS_STYLES: Record<string, string> = {
  IN_PROGRESS: 'bg-white text-slate-600 border-black/10',
  LOCKED: 'bg-white text-slate-600 border-black/10',
  DISCONNECTED: 'bg-white text-slate-600 border-black/10',
  SUBMITTED: 'bg-white text-slate-600 border-black/10',
  FORCE_SUBMITTED: 'bg-white text-slate-600 border-black/10',
  TIME_EXPIRED: 'bg-white text-slate-600 border-black/10',
};

function LiveStatusBadge({ status }: { status: string }) {
  const label = status.split('_').map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join(' ');
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${LIVE_STATUS_STYLES[status] ?? 'bg-white text-slate-600 border-black/10'}`}>
      {label}
    </span>
  );
}

function LiveRowActions({
  row,
  acting,
  onLock,
  onUnlock,
  onForceSubmit,
}: { row: any; acting: boolean; onLock: () => void; onUnlock: () => void; onForceSubmit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [action, setAction] = useState<null | 'lock' | 'force'>(null);
  const live = ['IN_PROGRESS', 'LOCKED', 'DISCONNECTED'].includes(row.status);

  return (
    <div className="inline-flex items-center gap-1">
      {row.status === 'IN_PROGRESS' || row.status === 'DISCONNECTED' ? (
        <IconButton
          title="Lock student"
          danger
          onClick={() => {
            setAction('lock');
            setConfirm(true);
          }}
        >
          <LockMini className="h-4 w-4" />
        </IconButton>
      ) : null}
      {row.status === 'LOCKED' ? (
        <IconButton title="Unlock student" onClick={onUnlock}>
          <UnlockMini className="h-4 w-4" />
        </IconButton>
      ) : null}
      {live ? (
        <IconButton
          title="Force submit now"
          danger
          onClick={() => {
            setAction('force');
            setConfirm(true);
          }}
        >
          <CheckCircle2Icon className="h-4 w-4" />
        </IconButton>
      ) : null}
      {acting ? <span className="ml-1 text-[11px] text-slate-400">…</span> : null}
      <ConfirmDialog
        open={confirm}
        title={action === 'lock' ? 'Lock this student?' : 'Submit this attempt now?'}
        message={
          action === 'lock'
            ? 'The student will be paused until you unlock them.'
            : 'The attempt ends immediately and everything answered so far is scored.'
        }
        confirmLabel={action === 'lock' ? 'Lock' : 'Submit now'}
        destructive
        onConfirm={() => {
          setConfirm(false);
          if (action === 'lock') onLock();
          else onForceSubmit();
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

function LockMini(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockMini(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}