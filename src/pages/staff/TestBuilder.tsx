import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, SaveIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { TextAreaField } from '../../components/TextAreaField';
import { SelectField } from '../../components/SelectField';
import { LoadingState } from '../../components/LoadingState';
import { staffNav } from './staffNav';
import { api } from '../../services/api';
import { questionTypeLabels, testTypeLabels } from '../../services/evaluation';
import type { QuestionType, SelectionMode, TestType } from '../../types';

const questionCountPresets = [10, 20, 30, 40, 50];
const durationPresets = [30, 45, 60, 90, 120];


interface FormState {
  name: string;
  description: string;
  type: TestType;
  questionCount: number;
  durationMinutes: number;
  selectionMode: SelectionMode;
  distribution: Partial<Record<QuestionType, number>>;
  scheduledStart: string;
  timingReason: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  type: 'MIXED',
  questionCount: 30,
  durationMinutes: 60,
  selectionMode: 'MANUAL',
  distribution: {},
  scheduledStart: '',
  timingReason: ''
};

export function TestBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [originalDuration, setOriginalDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.
    test(id).
    then((res) => {
      const t = res.test;
      setForm({
        name: t.name,
        description: t.description,
        type: t.type,
        questionCount: t.questionCount,
        durationMinutes: t.durationMinutes,
        selectionMode: t.selectionMode,
        distribution: t.distribution ?? {},
        scheduledStart: t.scheduledStart ? String(t.scheduledStart).slice(0, 16) : '',
        timingReason: ''
      });
      setOriginalDuration(t.durationMinutes);
    }).
    catch((err) => toast.error(err.message)).
    finally(() => setLoading(false));
  }, [id]);

  const update = useCallback(<K extends keyof FormState,>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const durationChanged = originalDuration !== null && originalDuration !== form.durationMinutes;

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Test name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        questionCount: Number(form.questionCount),
        durationMinutes: Number(form.durationMinutes),
        scheduledStart: form.scheduledStart || null
      };
      if (editing && id) {
        await api.updateTest(id, payload);
        toast.success('Test updated');
      } else {
        await api.createTest(payload);
        toast.success('Test created');
      }
      navigate('/staff/tests');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout portalLabel="Staff Portal" navItems={staffNav}>
      {loading ?
      <LoadingState label="Loading test…" /> :

      <div className="mx-auto max-w-4xl space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeftIcon className="h-4 w-4" />}
              onClick={() => navigate('/staff/tests')}>
              
                Back
              </Button>
              <h1 className="text-2xl font-bold text-navy-800">
                {editing ? 'Edit test' : 'Create test'}
              </h1>
            </div>
            <Button icon={<SaveIcon className="h-4 w-4" />} loading={saving} onClick={save}>
              {editing ? 'Save changes' : 'Create test'}
            </Button>
          </div>

          <Card>
            <CardHeader title="Test details" />
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <TextField
              label="Test name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g. Python Fundamentals"
              required />
            
              <SelectField
              label="Test type"
              value={form.type}
              onChange={(e) => update('type', e.target.value as TestType)}
              options={Object.entries(testTypeLabels).map(([value, label]) => ({ value, label }))} />
            
              <div className="md:col-span-2">
                <TextAreaField
                label="Description"
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What does this assessment cover?" />
              
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
            title="Configuration"
            description="Counts and durations accept presets or any custom value." />
          
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div>
                <TextField
                label="Question count"
                type="number"
                min={1}
                value={String(form.questionCount)}
                onChange={(e) => update('questionCount', Number(e.target.value))} />
              
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {questionCountPresets.map((count) =>
                <button
                  key={count}
                  type="button"
                  onClick={() => update('questionCount', count)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition-colors duration-150 ease-out hover:border-brand-400 hover:text-brand-700">
                  
                      {count}
                    </button>
                )}
                </div>
              </div>

              <div>
                <TextField
                label="Duration (minutes)"
                type="number"
                min={1}
                value={String(form.durationMinutes)}
                onChange={(e) => update('durationMinutes', Number(e.target.value))} />
              
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {durationPresets.map((minutes) =>
                <button
                  key={minutes}
                  type="button"
                  onClick={() => update('durationMinutes', minutes)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition-colors duration-150 ease-out hover:border-brand-400 hover:text-brand-700">
                  
                      {minutes}
                    </button>
                )}
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 p-4 ring-1 ring-blue-200">
                <p className="text-sm font-bold text-blue-900">How to add questions</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-700">
                  Go to <strong>Question Bank</strong> → add questions via <strong>CSV file</strong> or <strong>manual entry</strong>. Then pick them for this test after creation.
                </p>
              </div>

              <TextField
              label="Scheduled start"
              type="datetime-local"
              value={form.scheduledStart}
              onChange={(e) => update('scheduledStart', e.target.value)}
              hint="Students wait in the waiting room until staff start the test." />
            

              {durationChanged ?
            <div className="md:col-span-2">
                  <TextField
                label="Reason for timing change"
                value={form.timingReason}
                onChange={(e) => update('timingReason', e.target.value)}
                placeholder={`${originalDuration} → ${form.durationMinutes} minutes`}
                hint="Timing changes are recorded in the audit log with your staff ID." />
              
                </div> :
            null}
            </div>
          </Card>


        </div>
      }
    </PortalLayout>);

}