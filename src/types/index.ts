/** Shared domain types. These mirror the SQLite schema in backend/schema.sql. */

export type Role = 'DEVELOPER' | 'SUPER_ADMIN' | 'STAFF' | 'STUDENT';

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export type QuestionType =
'MCQ' |
'TRUE_FALSE' |
'FILL_BLANK' |
'OUTPUT' |
'CODE_COMPLETION' |
'DEBUGGING' |
'CODING';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export interface Question {
  id: string;
  version: number;
  title: string;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
  marks: number;
  status: QuestionStatus;
  /** Prompt shown to the student. */
  prompt: string;
  /** Optional code block rendered above the answer area. */
  code?: string;
  /** MCQ options. */
  options?: string[];
  /** MCQ correct option index, TRUE_FALSE 'true' | 'false', otherwise expected text. */
  answer: string;
  /** Accepted alternative answers for normalized comparison. */
  alternatives?: string[];
  explanation?: string;
  /** CODING metadata. */
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  sampleInput?: string;
  sampleOutput?: string;
  testCases?: {input: string;output: string;}[];
  createdBy: string;
  createdAt: string;
}

export interface QuestionVersion {
  id: string;
  questionId: string;
  version: number;
  snapshot: Question;
  changedBy: string;
  reason: string;
  createdAt: string;
}

export type TestStatus =
'DRAFT' |
'SCHEDULED' |
'ACTIVE' |
'PAUSED' |
'COMPLETED' |
'ARCHIVED';

export type TestType =
'QUIZ' |
'MCQ' |
'FILL_BLANK' |
'OUTPUT' |
'CODE_COMPLETION' |
'DEBUGGING' |
'CODING' |
'MIXED';

export type SelectionMode = 'RANDOM' | 'MANUAL' | 'DISTRIBUTION';

export interface Test {
  id: string;
  eventId: string;
  name: string;
  description: string;
  type: TestType;
  questionCount: number;
  durationMinutes: number;
  selectionMode: SelectionMode;
  distribution: Partial<Record<QuestionType, number>>;
  manualQuestionIds: string[];
  scheduledStart: string | null;
  status: TestStatus;
  resultsPublished: boolean;
  startedAt: string | null;
  stoppedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export type AttemptStatus =
'NOT_STARTED' |
'IN_PROGRESS' |
'LOCKED' |
'SUBMITTED' |
'FORCE_SUBMITTED' |
'TIME_EXPIRED' |
'DISCONNECTED';

export interface Attempt {
  id: string;
  testId: string;
  studentId: string;
  status: AttemptStatus;
  questionIds: string[];
  startedAt: string | null;
  deadline: string | null;
  submittedAt: string | null;
  lockedByStaff: string | null;
  lockReason: string | null;
  currentQuestion: number;
  lastActivity: string;
  sessionToken: string | null;
}

export interface AnswerRecord {
  attemptId: string;
  questionId: string;
  value: string;
  locked: boolean;
  editGranted: boolean;
  updatedAt: string;
}

export type EditRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface EditRequest {
  id: string;
  attemptId: string;
  studentId: string;
  testId: string;
  questionId: string;
  currentAnswer: string;
  reason: string;
  status: EditRequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface Result {
  id: string;
  attemptId: string;
  testId: string;
  studentId: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unanswered: number;
  score: number;
  maxScore: number;
  percentage: number;
  timeUsedSeconds: number;
  submittedAt: string;
  published: boolean;
  breakdown: {
    questionId: string;
    type: QuestionType;
    marks: number;
    awarded: number;
    correct: boolean | null;
    given: string;
    expected: string;
  }[];
}

export interface SecurityEvent {
  id: string;
  type: string;
  actor: string;
  role: Role | 'SYSTEM';
  testId?: string;
  attemptId?: string;
  detail: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  metadata: string;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  name: string;
  description: string;
  department: string;
  startDate: string;
  endDate: string;
  venue: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  registrationSite: string;
  registrationFee: string;
  prizePool: string;
}

export interface Session {
  token: string;
  userId: string;
  role: Role;
  createdAt: string;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}