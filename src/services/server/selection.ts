import type { Question, QuestionType, Test } from '../../types';
import { db } from '../db';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The server — never the browser — decides which questions an attempt gets.
 * The chosen IDs are frozen onto the attempt so a mid-test question edit
 * cannot change what a student is already answering.
 */
export function selectQuestionsForAttempt(test: Test): string[] {
  const ownedIds = db.testQuestions.
  filter((l) => l.testId === test.id).
  map((l) => l.questionId);
  const scoped = new Set(ownedIds);
  const active = db.questions.filter((q) => q.status === 'ACTIVE' && (scoped.size === 0 || scoped.has(q.id)));

  if (test.selectionMode === 'MANUAL' && test.manualQuestionIds.length > 0) {
    return test.manualQuestionIds.filter((id) => active.some((q) => q.id === id)).slice(0, test.questionCount);
  }

  if (test.selectionMode === 'DISTRIBUTION') {
    const picked: string[] = [];
    (Object.entries(test.distribution) as [QuestionType, number][]).forEach(([type, count]) => {
      const wanted = Math.max(0, Number(count) || 0);
      const pool = shuffle(active.filter((q) => q.type === type));
      picked.push(...pool.slice(0, wanted).map((q) => q.id));
    });
    if (picked.length < test.questionCount) {
      const filler = shuffle(active.filter((q) => !picked.includes(q.id)));
      picked.push(...filler.slice(0, test.questionCount - picked.length).map((q) => q.id));
    }
    return shuffle(picked).slice(0, test.questionCount);
  }

  const pool =
  scoped.size > 0 || test.type === 'MIXED' || test.type === 'QUIZ' ?
  active :
  active.filter((q) => q.type === test.type as unknown as QuestionType);
  const base = pool.length > 0 ? pool : active;
  return shuffle(base).slice(0, test.questionCount).map((q) => q.id);
}

/** Question payload sent to a student — answers and explanations stripped. */
export function sanitizeQuestion(q: Question) {
  return {
    id: q.id,
    version: q.version,
    title: q.title,
    type: q.type,
    topic: q.topic,
    difficulty: q.difficulty,
    marks: q.marks,
    prompt: q.prompt,
    code: q.code,
    options: q.options,
    inputFormat: q.inputFormat,
    outputFormat: q.outputFormat,
    constraints: q.constraints,
    sampleInput: q.sampleInput,
    sampleOutput: q.sampleOutput
  };
}

export type StudentQuestion = ReturnType<typeof sanitizeQuestion>;