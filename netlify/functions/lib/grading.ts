/** Server-side grading. A score is never accepted from the client. */

interface QuestionRow {
  marks: unknown;
  type: string;
  answer: string | null;
  alternatives: unknown;
}

function normalize(value: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/;+$/, "");
}

function normalizeCode(value: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "");
}

export interface GradeResult {
  correct: boolean | null;
  awarded: number;
}

export function gradeAnswer(question: QuestionRow, given: string): GradeResult {
  const value = (given || "").trim();
  const marks = Number(question.marks) || 0;
  if (!value) return { correct: false, awarded: 0 };

  let alternatives: string[] = [];
  if (question.alternatives) {
    try {
      const parsed = JSON.parse(String(question.alternatives));
      if (Array.isArray(parsed)) alternatives = parsed.map((a) => String(a ?? ""));
    } catch {
      alternatives = [];
    }
  }
  const accepted = [question.answer || "", ...alternatives];
  const qtype = question.type;
  let correct: boolean | null;

  if (qtype === "MCQ" || qtype === "TRUE_FALSE") {
    correct = normalize(value) === normalize(question.answer || "");
  } else if (qtype === "FILL_BLANK" || qtype === "OUTPUT") {
    correct = accepted.some((a) => normalize(a) === normalize(value));
  } else if (qtype === "CODE_COMPLETION" || qtype === "DEBUGGING") {
    correct = accepted.some((a) => normalizeCode(a) === normalizeCode(value));
  } else {
    // CODING: stored for sandboxed or manual evaluation. Code is never executed.
    return { correct: null, awarded: 0 };
  }

  return { correct, awarded: correct ? marks : 0 };
}