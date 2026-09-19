import type { Attempt, Result } from '../../types';
import { db, now, security, uid } from '../db';
import { gradeAnswer } from '../evaluation';
import { sanitizeQuestion, selectQuestionsForAttempt } from './selection';
import { HttpError, requireRole, type Ctx, type Handler } from './types';

function getTest(testId: string) {
  const test = db.tests.find((t) => t.id === testId);
  if (!test) throw new HttpError(404, 'Test is not available.');
  return test;
}

function assignedTests(studentId: string) {
  return db.tests.
  filter((t) => ['SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED'].includes(t.status)).
  map((test) => {
    const attempt = db.attempts.find((a) => a.testId === test.id && a.studentId === studentId);
    const result = db.results.find((r) => r.testId === test.id && r.studentId === studentId);
    return {
      id: test.id,
      name: test.name,
      description: test.description,
      type: test.type,
      eventId: test.eventId,
      questionCount: test.questionCount,
      durationMinutes: test.durationMinutes,
      scheduledStart: test.scheduledStart,
      status: test.status,
      attemptStatus: attempt?.status ?? 'NOT_STARTED',
      attemptId: attempt?.id ?? null,
      resultAvailable: Boolean(result && test.resultsPublished)
    };
  });
}

function ownAttempt(ctx: Ctx, attemptId: string): Attempt {
  const user = requireRole(ctx, 'STUDENT');
  const attempt = db.attempts.find((a) => a.id === attemptId);
  if (!attempt) throw new HttpError(404, 'Attempt not found.');
  if (attempt.studentId !== user.id) {
    security('UNAUTHORIZED_ACCESS', user.id, user.role, `Attempted to open attempt ${attemptId}`);
    throw new HttpError(403, 'You do not have permission to view this attempt.');
  }
  return attempt;
}

function attemptPayload(attempt: Attempt) {
  const test = getTest(attempt.testId);
  const questions = attempt.questionIds.
  map((id) => db.questions.find((q) => q.id === id)).
  filter(Boolean).
  map((q) => sanitizeQuestion(q!));
  const answers = db.answers.filter((a) => a.attemptId === attempt.id);
  return {
    attempt: {
      id: attempt.id,
      testId: attempt.testId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      deadline: attempt.deadline,
      currentQuestion: attempt.currentQuestion,
      lockedByStaff: attempt.lockedByStaff,
      lockReason: attempt.lockReason
    },
    test: {
      id: test.id,
      name: test.name,
      type: test.type,
      status: test.status,
      durationMinutes: test.durationMinutes,
      questionCount: attempt.questionIds.length
    },
    questions,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      value: a.value,
      locked: a.locked,
      editGranted: a.editGranted
    })),
    serverTime: now()
  };
}

function finalizeAttempt(
attempt: Attempt,
incoming: Record<string, string>,
reason: 'NORMAL' | 'TIME_EXPIRED' | 'FORCE_SUBMITTED')
: Result {
  const test = getTest(attempt.testId);

  attempt.questionIds.forEach((questionId) => {
    const value = incoming?.[questionId];
    if (value === undefined) return;
    const existing = db.answers.find(
      (a) => a.attemptId === attempt.id && a.questionId === questionId
    );
    if (existing) {
      if (!existing.locked || existing.editGranted) {
        existing.value = value;
        existing.locked = true;
        existing.editGranted = false;
        existing.updatedAt = now();
      }
    } else {
      db.answers.push({
        attemptId: attempt.id,
        questionId,
        value,
        locked: true,
        editGranted: false,
        updatedAt: now()
      });
    }
  });

  const breakdown: Result['breakdown'] = [];
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  let score = 0;
  let maxScore = 0;

  attempt.questionIds.forEach((questionId) => {
    const question = db.questions.find((q) => q.id === questionId);
    if (!question) return;
    maxScore += question.marks;
    const record = db.answers.find(
      (a) => a.attemptId === attempt.id && a.questionId === questionId
    );
    const given = record?.value?.trim() ?? '';
    if (!given) {
      unanswered += 1;
      breakdown.push({
        questionId,
        type: question.type,
        marks: question.marks,
        awarded: 0,
        correct: false,
        given: '',
        expected: question.answer
      });
      return;
    }
    const graded = gradeAnswer(question, given);
    score += graded.awarded;
    if (graded.correct === true) correct += 1;else
    if (graded.correct === false) wrong += 1;
    breakdown.push({
      questionId,
      type: question.type,
      marks: question.marks,
      awarded: graded.awarded,
      correct: graded.correct,
      given,
      expected: question.answer
    });
  });

  const submittedAt = now();
  const startedMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
  const timeUsedSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));

  attempt.status =
  reason === 'FORCE_SUBMITTED' ?
  'FORCE_SUBMITTED' :
  reason === 'TIME_EXPIRED' ?
  'TIME_EXPIRED' :
  'SUBMITTED';
  attempt.submittedAt = submittedAt;
  attempt.lastActivity = submittedAt;
  attempt.sessionToken = null;

  const attempted = attempt.questionIds.length - unanswered;
  const result: Result = {
    id: uid('RS'),
    attemptId: attempt.id,
    testId: attempt.testId,
    studentId: attempt.studentId,
    totalQuestions: attempt.questionIds.length,
    attempted,
    correct,
    wrong,
    unanswered,
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round(score / maxScore * 1000) / 10 : 0,
    timeUsedSeconds,
    submittedAt,
    published: test.resultsPublished,
    breakdown
  };
  const existingIndex = db.results.findIndex((r) => r.attemptId === attempt.id);
  if (existingIndex >= 0) db.results.splice(existingIndex, 1, result);else
  db.results.unshift(result);

  security(
    reason === 'FORCE_SUBMITTED' ? 'FORCE_SUBMITTED' : 'TEST_SUBMITTED',
    attempt.studentId,
    'STUDENT',
    `${test.name} finalised (${reason.toLowerCase().replace('_', ' ')})`,
    { testId: test.id, attemptId: attempt.id }
  );
  return result;
}

export { finalizeAttempt };

export const studentRoutes: Record<string, Handler> = {
  'GET /api/student/dashboard': (ctx) => {
    const user = requireRole(ctx, 'STUDENT');
    const tests = assignedTests(user.id);
    return {
      student: { id: user.id, name: user.name, email: user.email },
      event: db.events[0],
      tests,
      results: db.results.
      filter((r) => r.studentId === user.id && r.published).
      map((r) => ({
        id: r.id,
        testId: r.testId,
        testName: db.tests.find((t) => t.id === r.testId)?.name ?? r.testId,
        score: r.score,
        maxScore: r.maxScore,
        percentage: r.percentage,
        submittedAt: r.submittedAt
      })),
      serverTime: now()
    };
  },

  'GET /api/student/tests': (ctx) => {
    const user = requireRole(ctx, 'STUDENT');
    return { tests: assignedTests(user.id), serverTime: now() };
  },

  'GET /api/student/tests/:id': (ctx) => {
    const user = requireRole(ctx, 'STUDENT');
    const test = getTest(ctx.params.id);
    const attempt = db.attempts.find((a) => a.testId === test.id && a.studentId === user.id);
    return {
      test: {
        id: test.id,
        name: test.name,
        description: test.description,
        type: test.type,
        questionCount: test.questionCount,
        durationMinutes: test.durationMinutes,
        scheduledStart: test.scheduledStart,
        status: test.status,
        startedAt: test.startedAt
      },
      event: db.events.find((e) => e.id === test.eventId) ?? db.events[0],
      attemptStatus: attempt?.status ?? 'NOT_STARTED',
      attemptId: attempt?.id ?? null,
      serverTime: now()
    };
  },

  'POST /api/student/tests/:id/start': (ctx) => {
    const user = requireRole(ctx, 'STUDENT');
    const test = getTest(ctx.params.id);
    if (test.status === 'COMPLETED' || test.status === 'ARCHIVED') {
      throw new HttpError(409, 'This test has already ended.');
    }
    if (test.status !== 'ACTIVE') {
      throw new HttpError(409, 'The test has not been started by examination staff yet.');
    }
    if (test.scheduledStart && Date.now() < new Date(test.scheduledStart).getTime()) {
      throw new HttpError(409, 'This test has not started yet.');
    }

    let attempt = db.attempts.find((a) => a.testId === test.id && a.studentId === user.id);
    if (attempt && ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(attempt.status)) {
      throw new HttpError(409, 'You have already submitted this test.');
    }

    if (!attempt) {
      const startedAt = new Date();
      const deadline = new Date(startedAt.getTime() + test.durationMinutes * 60 * 1000);
      attempt = {
        id: uid('AT'),
        testId: test.id,
        studentId: user.id,
        status: 'IN_PROGRESS',
        questionIds: selectQuestionsForAttempt(test),
        startedAt: startedAt.toISOString(),
        deadline: deadline.toISOString(),
        submittedAt: null,
        lockedByStaff: null,
        lockReason: null,
        currentQuestion: 0,
        lastActivity: now(),
        sessionToken: ctx.token
      };
      db.attempts.push(attempt);
      security('TEST_STARTED', user.id, 'STUDENT', `Started ${test.name}`, {
        testId: test.id,
        attemptId: attempt.id
      });
    } else {
      if (attempt.sessionToken && attempt.sessionToken !== ctx.token) {
        security(
          'MULTIPLE_SESSION_DETECTED',
          user.id,
          'STUDENT',
          'Attempt resumed from a different session',
          { testId: test.id, attemptId: attempt.id }
        );
      }
      attempt.sessionToken = ctx.token;
      attempt.status = attempt.status === 'LOCKED' ? 'LOCKED' : 'IN_PROGRESS';
      attempt.lastActivity = now();
    }
    return attemptPayload(attempt);
  },

  'GET /api/student/attempts/:id': (ctx) => attemptPayload(ownAttempt(ctx, ctx.params.id)),

  'POST /api/student/attempts/:id/lock': (ctx) => {
    const attempt = ownAttempt(ctx, ctx.params.id);
    if (attempt.status !== 'IN_PROGRESS') {
      throw new HttpError(409, 'This attempt is no longer editable.');
    }
    const { questionId, value } = ctx.body ?? {};
    if (!attempt.questionIds.includes(questionId)) {
      throw new HttpError(400, 'That question is not part of your attempt.');
    }
    const existing = db.answers.find(
      (a) => a.attemptId === attempt.id && a.questionId === questionId
    );
    if (existing && existing.locked && !existing.editGranted) {
      throw new HttpError(409, 'This answer is locked. Request a modification to change it.');
    }
    if (existing) {
      existing.value = String(value ?? '');
      existing.locked = true;
      existing.editGranted = false;
      existing.updatedAt = now();
    } else {
      db.answers.push({
        attemptId: attempt.id,
        questionId,
        value: String(value ?? ''),
        locked: true,
        editGranted: false,
        updatedAt: now()
      });
    }
    attempt.lastActivity = now();
    security('ANSWER_LOCKED', attempt.studentId, 'STUDENT', `Locked ${questionId}`, {
      testId: attempt.testId,
      attemptId: attempt.id
    });
    return { ok: true, questionId, locked: true };
  },

  'POST /api/student/attempts/:id/heartbeat': (ctx) => {
    const attempt = ownAttempt(ctx, ctx.params.id);
    const test = getTest(attempt.testId);

    // Authoritative deadline: the browser clock is advisory only. Expire the
    // attempt server-side and grade whatever was locked so far.
    let autoSubmitted = false;
    if (
      ['IN_PROGRESS', 'LOCKED'].includes(attempt.status) &&
      attempt.deadline &&
      Date.now() > new Date(attempt.deadline).getTime()
    ) {
      const stored: Record<string, string> = {};
      db.answers
        .filter((a) => a.attemptId === attempt.id)
        .forEach((a) => {
          stored[a.questionId] = a.value;
        });
      finalizeAttempt(attempt, stored, 'TIME_EXPIRED');
      autoSubmitted = true;
    }

    const { currentQuestion } = ctx.body ?? {};
    if (typeof currentQuestion === 'number' && attempt.status === 'IN_PROGRESS') {
      attempt.currentQuestion = currentQuestion;
    }
    attempt.lastActivity = now();
    const grants = db.answers.
    filter((a) => a.attemptId === attempt.id && a.editGranted).
    map((a) => a.questionId);
    const finalStates = ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'];
    return {
      status: attempt.status,
      testStatus: test.status,
      forceSubmit:
      test.status === 'COMPLETED' ||
      test.status === 'PAUSED' ||
      finalStates.includes(attempt.status) ||
      (attempt.deadline ? Date.now() > new Date(attempt.deadline).getTime() : false),
      autoSubmitted,
      locked: attempt.status === 'LOCKED',
      lockReason: attempt.lockReason,
      editGrants: grants,
      deadline: attempt.deadline,
      serverTime: now()
    };
  },

  'POST /api/student/attempts/:id/submit': (ctx) => {
    const attempt = ownAttempt(ctx, ctx.params.id);
    if (['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(attempt.status)) {
      throw new HttpError(409, 'This attempt has already been submitted.');
    }
    const test = getTest(attempt.testId);
    const answers = (ctx.body?.answers ?? {}) as Record<string, string>;
    const clientReason = ctx.body?.reason as string | undefined;

    // The server decides why the attempt ended — never the browser clock.
    const expired = attempt.deadline ? Date.now() > new Date(attempt.deadline).getTime() : false;
    const forced = test.status === 'COMPLETED' || test.status === 'PAUSED';
    const reason: 'NORMAL' | 'TIME_EXPIRED' | 'FORCE_SUBMITTED' = forced ?
    'FORCE_SUBMITTED' :
    expired || clientReason === 'TIME_EXPIRED' ?
    'TIME_EXPIRED' :
    'NORMAL';

    const result = finalizeAttempt(attempt, answers, reason);
    return {
      submitted: true,
      reason,
      resultPublished: result.published,
      summary: result.published ?
      {
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage
      } :
      null
    };
  },

  'POST /api/student/attempts/:id/edit-request': (ctx) => {
    const attempt = ownAttempt(ctx, ctx.params.id);
    const { questionId, reason } = ctx.body ?? {};
    const record = db.answers.find(
      (a) => a.attemptId === attempt.id && a.questionId === questionId
    );
    if (!record) throw new HttpError(400, 'That answer has not been locked yet.');
    const pending = db.editRequests.find(
      (r) => r.attemptId === attempt.id && r.questionId === questionId && r.status === 'PENDING'
    );
    if (pending) throw new HttpError(409, 'A request for this question is already pending.');

    const request = {
      id: uid('ER'),
      attemptId: attempt.id,
      studentId: attempt.studentId,
      testId: attempt.testId,
      questionId,
      currentAnswer: record.value,
      reason: String(reason ?? ''),
      status: 'PENDING' as const,
      decidedBy: null,
      decidedAt: null,
      createdAt: now()
    };
    db.editRequests.unshift(request);
    security('MODIFICATION_REQUEST', attempt.studentId, 'STUDENT', `Requested edit for ${questionId}`, {
      testId: attempt.testId,
      attemptId: attempt.id
    });
    return { request };
  },

  'GET /api/student/results': (ctx) => {
    const user = requireRole(ctx, 'STUDENT');
    const results = db.results.
    filter((r) => r.studentId === user.id && r.published).
    map((r) => ({
      ...r,
      testName: db.tests.find((t) => t.id === r.testId)?.name ?? r.testId,
      studentName: user.name
    }));
    return { results };
  }
};