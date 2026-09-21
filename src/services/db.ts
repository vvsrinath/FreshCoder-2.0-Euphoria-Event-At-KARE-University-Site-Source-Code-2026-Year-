import type {
  AnswerRecord,
  Attempt,
  AuditLog,
  EditRequest,
  EventRecord,
  Question,
  Result,
  Role,
  SecurityEvent,
  Session,
  Test,
  User } from
'../types';
import { eventConfig } from '../data/eventConfig';
import { seedQuestions } from '../data/seedQuestions';
import { seedUsers } from '../data/seedUsers';

/**
 * In-browser stand-in for the SQLite database used by the Flask backend.
 * Table names and columns mirror backend/schema.sql one for one so the
 * REST contract is identical whether requests hit this module or Flask.
 */

export interface Store {
  users: (User & {passwordHash: string;})[];
  events: EventRecord[];
  tests: Test[];
  questions: Question[];
  testQuestions: {testId: string;questionId: string;position: number;}[];
  questionVersions: {
    id: string;
    questionId: string;
    version: number;
    snapshot: Question;
    changedBy: string;
    reason: string;
    createdAt: string;
  }[];
  attempts: Attempt[];
  answers: AnswerRecord[];
  editRequests: EditRequest[];
  results: Result[];
  securityEvents: SecurityEvent[];
  auditLogs: AuditLog[];
  sessions: Session[];
  timingChanges: {
    id: string;
    testId: string;
    oldDuration: number;
    newDuration: number;
    staffId: string;
    reason: string;
    createdAt: string;
  }[];
}

let counter = 1000;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

export function now(): string {
  return new Date().toISOString();
}

/** Demo-only digest. The Flask backend uses werkzeug PBKDF2 hashing. */
export function hashPassword(raw: string): string {
  let h = 5381;
  for (let i = 0; i < raw.length; i += 1) {
    h = h * 33 ^ raw.charCodeAt(i);
  }
  return `demo$${(h >>> 0).toString(16)}$${raw.length}`;
}

export function verifyPassword(raw: string, hash: string): boolean {
  return hashPassword(raw) === hash;
}

function buildQuestions(): Question[] {
  return seedQuestions.map((q, index) => ({
    id: `Q${String(index + 1).padStart(3, '0')}`,
    version: 1,
    status: 'ACTIVE' as const,
    createdBy: 'STAFF001',
    createdAt: now(),
    ...q
  }));
}

function buildStore(): Store {
  const questions = buildQuestions();
  const event: EventRecord = {
    id: eventConfig.id,
    name: eventConfig.name,
    description: eventConfig.description,
    department: 'Department of Freshman Engineering',
    startDate: eventConfig.startDate,
    endDate: eventConfig.endDate,
    venue: `${eventConfig.venueBlock}, ${eventConfig.venueRooms}`,
    status: 'ACTIVE',
    registrationSite: eventConfig.registrationSite,
    registrationFee: eventConfig.registrationFee,
    prizePool: eventConfig.prizePool
  };

  const tests: Test[] = [
  {
    id: 'T1001',
    eventId: event.id,
    name: 'Python Fundamentals',
    description:
    'Mixed Python assessment covering basics, data types, loops, functions, output prediction and debugging.',
    type: 'MIXED',
    questionCount: 30,
    durationMinutes: 60,
    selectionMode: 'DISTRIBUTION',
    distribution: {
      MCQ: 10,
      FILL_BLANK: 5,
      OUTPUT: 5,
      CODE_COMPLETION: 5,
      DEBUGGING: 5
    },
    manualQuestionIds: [],
    scheduledStart: '2026-09-26T09:30:00',
    status: 'SCHEDULED',
    resultsPublished: false,
    startedAt: null,
    stoppedAt: null,
    createdBy: 'STAFF001',
    createdAt: now()
  },
  {
    id: 'T1002',
    eventId: event.id,
    name: 'Debugging Challenge',
    description: 'Find and fix defects in short Python programs.',
    type: 'DEBUGGING',
    questionCount: 20,
    durationMinutes: 45,
    selectionMode: 'RANDOM',
    distribution: {},
    manualQuestionIds: [],
    scheduledStart: null,
    status: 'DRAFT',
    resultsPublished: false,
    startedAt: null,
    stoppedAt: null,
    createdBy: 'STAFF001',
    createdAt: now()
  },
  {
    id: 'T1003',
    eventId: event.id,
    name: 'Fill in the Blanks',
    description: 'Rapid-fire syntax completion round.',
    type: 'FILL_BLANK',
    questionCount: 25,
    durationMinutes: 30,
    selectionMode: 'RANDOM',
    distribution: {},
    manualQuestionIds: [],
    scheduledStart: null,
    status: 'DRAFT',
    resultsPublished: false,
    startedAt: null,
    stoppedAt: null,
    createdBy: 'STAFF002',
    createdAt: now()
  },
  {
    id: 'T1004',
    eventId: event.id,
    name: 'Coding Challenge',
    description: 'Five programming problems evaluated against test cases.',
    type: 'CODING',
    questionCount: 5,
    durationMinutes: 90,
    selectionMode: 'RANDOM',
    distribution: {},
    manualQuestionIds: [],
    scheduledStart: null,
    status: 'DRAFT',
    resultsPublished: false,
    startedAt: null,
    stoppedAt: null,
    createdBy: 'STAFF002',
    createdAt: now()
  },
  {
    id: 'T1005',
    eventId: event.id,
    name: 'Output Prediction',
    description: 'Predict the exact output of short Python programs.',
    type: 'OUTPUT',
    questionCount: 20,
    durationMinutes: 40,
    selectionMode: 'RANDOM',
    distribution: {},
    manualQuestionIds: [],
    scheduledStart: null,
    status: 'DRAFT',
    resultsPublished: false,
    startedAt: null,
    stoppedAt: null,
    createdBy: 'STAFF001',
    createdAt: now()
  }];


  const users = seedUsers.map((u) => ({
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email,
    active: u.active,
    createdAt: now(),
    passwordHash: hashPassword(u.password)
  }));

  const auditLogs: AuditLog[] = [
  {
    id: uid('AL'),
    actor: 'ADMIN001',
    role: 'SUPER_ADMIN' as Role,
    action: 'Imported students',
    target: 'batch_1.csv',
    metadata: '5 records imported',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString()
  },
  {
    id: uid('AL'),
    actor: 'STAFF001',
    role: 'STAFF' as Role,
    action: 'Created test',
    target: 'Python Fundamentals',
    metadata: '30 questions · 60 minutes',
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString()
  },
  {
    id: uid('AL'),
    actor: 'STAFF001',
    role: 'STAFF' as Role,
    action: 'Published question set',
    target: 'Question Bank',
    metadata: `${questions.length} active questions`,
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString()
  }];


  return {
    users,
    events: [event],
    tests,
    questions,
    testQuestions: [],
    questionVersions: [],
    attempts: [],
    answers: [],
    editRequests: [],
    results: [],
    securityEvents: [],
    auditLogs,
    sessions: [],
    timingChanges: []
  };
}

export const db: Store = buildStore();

export function resetDb(): void {
  const fresh = buildStore();
  (Object.keys(fresh) as (keyof Store)[]).forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)[key] = (fresh as any)[key];
  });
}

export function audit(
actor: string,
role: Role,
action: string,
target: string,
metadata = '')
: void {
  db.auditLogs.unshift({
    id: uid('AL'),
    actor,
    role,
    action,
    target,
    metadata,
    createdAt: now()
  });
}

export function security(
type: string,
actor: string,
role: Role | 'SYSTEM',
detail: string,
extra: {testId?: string;attemptId?: string;} = {})
: void {
  db.securityEvents.unshift({
    id: uid('SE'),
    type,
    actor,
    role,
    detail,
    createdAt: now(),
    ...extra
  });
}