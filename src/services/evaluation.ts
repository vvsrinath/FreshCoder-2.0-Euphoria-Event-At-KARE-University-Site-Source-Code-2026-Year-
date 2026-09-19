import type { Question } from '../types';

/**
 * Server-side evaluation. A score is never accepted from the client:
 * the grader runs where the correct answers live.
 */

function normalize(value: string): string {
  return value.
  trim().
  toLowerCase().
  replace(/\s+/g, ' ').
  replace(/[;]+$/g, '');
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export interface Graded {
  correct: boolean | null;
  awarded: number;
}

export function gradeAnswer(question: Question, given: string): Graded {
  const value = (given ?? '').trim();
  if (!value) return { correct: false, awarded: 0 };

  switch (question.type) {
    case 'MCQ':
    case 'TRUE_FALSE':{
        const correct = normalize(value) === normalize(question.answer);
        return { correct, awarded: correct ? question.marks : 0 };
      }
    case 'FILL_BLANK':
    case 'OUTPUT':{
        const accepted = [question.answer, ...(question.alternatives ?? [])];
        const correct = accepted.some((a) => normalize(a) === normalize(value));
        return { correct, awarded: correct ? question.marks : 0 };
      }
    case 'CODE_COMPLETION':
    case 'DEBUGGING':{
        const accepted = [question.answer, ...(question.alternatives ?? [])];
        const correct = accepted.some((a) => normalizeCode(a) === normalizeCode(value));
        return { correct, awarded: correct ? question.marks : 0 };
      }
    case 'CODING':
    default:
      // Coding submissions are queued for manual / sandboxed evaluation.
      // Arbitrary student code is never executed in the application process.
      return { correct: null, awarded: 0 };
  }
}

export const questionTypeLabels: Record<string, string> = {
  MCQ: 'MCQ',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in the Blank',
  OUTPUT: 'Output Prediction',
  CODE_COMPLETION: 'Code Completion',
  DEBUGGING: 'Debugging',
  CODING: 'Coding'
};

export const testTypeLabels: Record<string, string> = {
  QUIZ: 'Quiz',
  MCQ: 'MCQ',
  FILL_BLANK: 'Fill in the Blank',
  OUTPUT: 'Output Prediction',
  CODE_COMPLETION: 'Code Completion',
  DEBUGGING: 'Debugging',
  CODING: 'Coding',
  MIXED: 'Mixed'
};