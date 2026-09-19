import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { TextAreaField } from '../../components/TextAreaField';
import { SelectField } from '../../components/SelectField';
import { api } from '../../services/api';
import { questionTypeLabels } from '../../services/evaluation';
import type { Question, QuestionType } from '../../types';

interface QuestionEditorProps {
  open: boolean;
  question: Question | null;
  onClose: () => void;
  onSaved: () => void;
}

const blank = {
  title: '',
  type: 'MCQ' as QuestionType,
  topic: 'Basics',
  difficulty: 'EASY',
  marks: 1,
  status: 'ACTIVE',
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
  reason: ''
};

export function QuestionEditor({ open, question, onClose, onSaved }: QuestionEditorProps) {
  const [form, setForm] = useState({ ...blank });
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
        inputFormat: question.inputFormat ?? '',
        outputFormat: question.outputFormat ?? '',
        constraints: question.constraints ?? '',
        sampleInput: question.sampleInput ?? '',
        sampleOutput: question.sampleOutput ?? '',
        reason: ''
      } as typeof blank);
    } else {
      setForm({ ...blank });
    }
  }, [question, open]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.title.trim() || !form.prompt.trim()) {
      toast.error('Title and question text are required.');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      type: form.type,
      topic: form.topic,
      difficulty: form.difficulty,
      marks: Number(form.marks),
      status: form.status,
      prompt: form.prompt,
      code: form.code || undefined,
      options: form.type === 'MCQ' ? form.options.filter((o) => o.trim()) : undefined,
      answer: form.answer,
      alternatives: form.alternatives ?
      form.alternatives.split(',').map((a) => a.trim()).filter(Boolean) :
      undefined,
      explanation: form.explanation || undefined,
      inputFormat: form.inputFormat || undefined,
      outputFormat: form.outputFormat || undefined,
      constraints: form.constraints || undefined,
      sampleInput: form.sampleInput || undefined,
      sampleOutput: form.sampleOutput || undefined,
      reason: form.reason || undefined
    };
    try {
      if (question) await api.updateQuestion(question.id, payload);else
      await api.createQuestion(payload);
      toast.success(question ? 'Question updated' : 'Question created');
      onSaved();
      onClose();
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
      title={question ? `Edit ${question.id}` : 'Add question'}
      description="Questions are reusable across every test in the bank."
      footer={
      <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            {question ? 'Save question' : 'Create question'}
          </Button>
        </>
      }>
      
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <TextField label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <SelectField
            label="Type"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            options={Object.entries(questionTypeLabels).map(([value, label]) => ({ value, label }))} />
          
          <TextField label="Topic" value={form.topic} onChange={(e) => set('topic', e.target.value)} />
          <SelectField
            label="Difficulty"
            value={form.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            options={[
            { value: 'EASY', label: 'Easy' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HARD', label: 'Hard' }]
            } />
          
          <TextField
            label="Marks"
            type="number"
            min={1}
            value={String(form.marks)}
            onChange={(e) => set('marks', Number(e.target.value))} />
          
          <SelectField
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'DRAFT', label: 'Draft' },
            { value: 'ARCHIVED', label: 'Archived' }]
            } />
          
        </div>

        <TextAreaField
          label="Question text"
          rows={3}
          value={form.prompt}
          onChange={(e) => set('prompt', e.target.value)} />
        

        {['FILL_BLANK', 'OUTPUT', 'CODE_COMPLETION', 'DEBUGGING'].includes(form.type) ?
        <TextAreaField
          label="Code block"
          mono
          rows={5}
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          placeholder="Python code shown with the question" /> :

        null}

        {form.type === 'MCQ' ?
        <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-navy-700">Options and correct answer</legend>
            {form.options.map((option, index) =>
          <div key={index} className="flex items-center gap-3">
                <input
              type="radio"
              name="correct-option"
              aria-label={`Mark option ${index + 1} correct`}
              checked={form.answer === String(index)}
              onChange={() => set('answer', String(index))}
              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500" />
            
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
              className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm transition-colors duration-150 ease-out focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
            
              </div>
          )}
          </fieldset> :
        form.type === 'TRUE_FALSE' ?
        <SelectField
          label="Correct answer"
          value={form.answer}
          onChange={(e) => set('answer', e.target.value)}
          options={[
          { value: 'true', label: 'True' },
          { value: 'false', label: 'False' }]
          } /> :

        form.type === 'CODING' ?
        <div className="grid gap-4 sm:grid-cols-2">
            <TextAreaField label="Input format" rows={2} value={form.inputFormat} onChange={(e) => set('inputFormat', e.target.value)} />
            <TextAreaField label="Output format" rows={2} value={form.outputFormat} onChange={(e) => set('outputFormat', e.target.value)} />
            <TextAreaField label="Constraints" rows={2} value={form.constraints} onChange={(e) => set('constraints', e.target.value)} />
            <TextField label="Sample input" value={form.sampleInput} onChange={(e) => set('sampleInput', e.target.value)} />
            <TextField label="Sample output" value={form.sampleOutput} onChange={(e) => set('sampleOutput', e.target.value)} />
            <p className="self-end text-xs text-slate-500 sm:col-span-2">
              Coding submissions are stored for sandboxed or manual evaluation. Student code is never
              executed inside the application server.
            </p>
          </div> :

        <div className="grid gap-4 sm:grid-cols-2">
            <TextField
            label="Expected answer"
            value={form.answer}
            onChange={(e) => set('answer', e.target.value)} />
          
            <TextField
            label="Alternative answers"
            value={form.alternatives}
            onChange={(e) => set('alternatives', e.target.value)}
            hint="Comma separated. Compared after normalisation." />
          
          </div>
        }

        <TextAreaField
          label="Explanation"
          rows={2}
          value={form.explanation}
          onChange={(e) => set('explanation', e.target.value)} />
        

        {question ?
        <TextField
          label="Reason for change"
          value={form.reason}
          onChange={(e) => set('reason', e.target.value)}
          hint="If this question is already in use, a new version is created and the original preserved." /> :

        null}
      </div>
    </Modal>);

}