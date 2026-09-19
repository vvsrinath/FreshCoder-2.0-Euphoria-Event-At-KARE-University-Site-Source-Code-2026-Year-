import type { Question, Test, TestStatus } from '../../types';
import { audit, db, now, security, uid } from '../db';
import { finalizeAttempt } from './studentRoutes';
import { HttpError, requireRole, type Handler } from './types';

const allowedTransitions: Record<TestStatus, TestStatus[]> = {
  DRAFT: ['SCHEDULED', 'ARCHIVED'],
  SCHEDULED: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: []
};

function getTest(id: string): Test {
  const test = db.tests.find((t) => t.id === id);
  if (!test) throw new HttpError(404, 'Test not found.');
  return test;
}

function distributionTotal(test: Pick<Test, 'distribution'>): number {
  return Object.values(test.distribution ?? {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

function transition(test: Test, next: TestStatus) {
  if (!allowedTransitions[test.status].includes(next)) {
    throw new HttpError(409, `A ${test.status.toLowerCase()} test cannot move to ${next.toLowerCase()}.`);
  }
  test.status = next;
}

function studentName(id: string): string {
  return db.users.find((u) => u.id === id)?.name ?? id;
}

export const staffRoutes: Record<string, Handler> = {
  'GET /api/staff/dashboard': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const students = db.users.filter((u) => u.role === 'STUDENT');
    const attempts = db.attempts;
    return {
      stats: {
        totalStudents: students.length,
        activeStudents: students.filter((s) => s.active).length,
        inProgress: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
        submitted: attempts.filter((a) =>
        ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(a.status)
        ).length,
        locked: attempts.filter((a) => a.status === 'LOCKED').length,
        disconnected: attempts.filter((a) => a.status === 'DISCONNECTED').length,
        editRequests: db.editRequests.filter((r) => r.status === 'PENDING').length,
        totalTests: db.tests.length,
        activeTests: db.tests.filter((t) => t.status === 'ACTIVE').length
      },
      activity: db.auditLogs.slice(0, 8),
      securityEvents: db.securityEvents.slice(0, 6),
      serverTime: now()
    };
  },

  'GET /api/staff/tests': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    return { tests: db.tests };
  },

  'POST /api/staff/tests': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const body = ctx.body ?? {};
    if (!body.name?.trim()) throw new HttpError(400, 'Test name is required.');
    const questionCount = Number(body.questionCount);
    if (!questionCount || questionCount < 1) throw new HttpError(400, 'Question count must be at least 1.');
    if (
    body.selectionMode === 'DISTRIBUTION' &&
    distributionTotal({ distribution: body.distribution ?? {} }) !== questionCount)
    {
      throw new HttpError(400, 'The question distribution must add up to the total question count.');
    }
    const test: Test = {
      id: uid('T'),
      eventId: body.eventId || db.events[0].id,
      name: body.name.trim(),
      description: body.description ?? '',
      type: body.type ?? 'MIXED',
      questionCount,
      durationMinutes: Number(body.durationMinutes) || 60,
      selectionMode: body.selectionMode ?? 'RANDOM',
      distribution: body.distribution ?? {},
      manualQuestionIds: body.manualQuestionIds ?? [],
      scheduledStart: body.scheduledStart || null,
      status: body.scheduledStart ? 'SCHEDULED' : 'DRAFT',
      resultsPublished: false,
      startedAt: null,
      stoppedAt: null,
      createdBy: user.id,
      createdAt: now()
    };
    db.tests.unshift(test);
    audit(user.id, user.role, 'Created test', test.name, `${test.questionCount} questions · ${test.durationMinutes} min`);
    return { test };
  },

  'GET /api/staff/tests/:id': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    return { test: getTest(ctx.params.id) };
  },

  'PUT /api/staff/tests/:id': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    const body = ctx.body ?? {};
    const questionCount = Number(body.questionCount ?? test.questionCount);
    if (
    (body.selectionMode ?? test.selectionMode) === 'DISTRIBUTION' &&
    distributionTotal({ distribution: body.distribution ?? test.distribution }) !== questionCount)
    {
      throw new HttpError(400, 'The question distribution must add up to the total question count.');
    }
    if (test.status === 'ACTIVE' && body.questionCount && body.questionCount !== test.questionCount) {
      throw new HttpError(409, 'Question count cannot change while the test is live.');
    }

    if (body.durationMinutes && Number(body.durationMinutes) !== test.durationMinutes) {
      const oldDuration = test.durationMinutes;
      const newDuration = Number(body.durationMinutes);
      db.timingChanges.unshift({
        id: uid('TC'),
        testId: test.id,
        oldDuration,
        newDuration,
        staffId: user.id,
        reason: body.timingReason ?? 'Not specified',
        createdAt: now()
      });
      audit(
        user.id,
        user.role,
        'Changed duration',
        test.name,
        `${oldDuration} → ${newDuration} minutes · ${body.timingReason ?? 'no reason given'}`
      );
      // Live attempts inherit the new deadline from the server.
      db.attempts.
      filter((a) => a.testId === test.id && a.status === 'IN_PROGRESS' && a.startedAt).
      forEach((a) => {
        a.deadline = new Date(
          new Date(a.startedAt as string).getTime() + newDuration * 60 * 1000
        ).toISOString();
      });
    }

    Object.assign(test, {
      name: body.name ?? test.name,
      description: body.description ?? test.description,
      type: body.type ?? test.type,
      questionCount,
      durationMinutes: Number(body.durationMinutes ?? test.durationMinutes),
      selectionMode: body.selectionMode ?? test.selectionMode,
      distribution: body.distribution ?? test.distribution,
      manualQuestionIds: body.manualQuestionIds ?? test.manualQuestionIds,
      scheduledStart: body.scheduledStart ?? test.scheduledStart
    });
    audit(user.id, user.role, 'Updated test', test.name, '');
    return { test };
  },

  'POST /api/staff/tests/:id/duplicate': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const source = getTest(ctx.params.id);
    const copy: Test = {
      ...source,
      id: uid('T'),
      name: `${source.name} (Copy)`,
      status: 'DRAFT',
      scheduledStart: null,
      startedAt: null,
      stoppedAt: null,
      resultsPublished: false,
      createdBy: user.id,
      createdAt: now()
    };
    db.tests.unshift(copy);
    audit(user.id, user.role, 'Duplicated test', copy.name, `from ${source.name}`);
    return { test: copy };
  },

  'POST /api/staff/tests/:id/schedule': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    if (
    test.selectionMode === 'DISTRIBUTION' &&
    distributionTotal(test) !== test.questionCount)
    {
      throw new HttpError(400, 'Fix the question distribution before scheduling this test.');
    }
    transition(test, 'SCHEDULED');
    test.scheduledStart = ctx.body?.scheduledStart ?? test.scheduledStart;
    audit(user.id, user.role, 'Scheduled test', test.name, String(test.scheduledStart ?? ''));
    return { test };
  },

  'POST /api/staff/tests/:id/start': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    if (test.status === 'DRAFT') transition(test, 'SCHEDULED');
    transition(test, 'ACTIVE');
    test.startedAt = now();
    audit(user.id, user.role, 'Started test', test.name, '');
    security('TEST_STARTED', user.id, user.role, `${test.name} opened for students`, { testId: test.id });
    return { test };
  },

  'POST /api/staff/tests/:id/stop': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    transition(test, 'PAUSED');
    audit(user.id, user.role, 'Paused test', test.name, '');
    return { test };
  },

  'POST /api/staff/tests/:id/force-stop': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    if (!['ACTIVE', 'PAUSED'].includes(test.status)) {
      throw new HttpError(409, 'Only a live test can be force stopped.');
    }
    test.status = 'COMPLETED';
    test.stoppedAt = now();
    const active = db.attempts.filter((a) => a.testId === test.id && ['IN_PROGRESS', 'LOCKED'].includes(a.status));
    active.forEach((attempt) => {
      const stored: Record<string, string> = {};
      db.answers.
      filter((a) => a.attemptId === attempt.id).
      forEach((a) => {
        stored[a.questionId] = a.value;
      });
      finalizeAttempt(attempt, stored, 'FORCE_SUBMITTED');
    });
    audit(user.id, user.role, 'Force stopped test', test.name, `${active.length} attempts finalised`);
    security('TEST_FORCE_STOPPED', user.id, user.role, `${test.name} force stopped`, { testId: test.id });
    return { test, finalised: active.length };
  },

  'GET /api/staff/tests/:id/timing-changes': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    return { changes: db.timingChanges.filter((c) => c.testId === ctx.params.id) };
  },

  // ---------------- QUESTIONS ----------------
  'GET /api/questions': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const { type, topic, difficulty, status, search } = ctx.query;
    let list = [...db.questions];
    if (type) list = list.filter((q) => q.type === type);
    if (topic) list = list.filter((q) => q.topic === topic);
    if (difficulty) list = list.filter((q) => q.difficulty === difficulty);
    if (status) list = list.filter((q) => q.status === status);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (q) => q.title.toLowerCase().includes(s) || q.id.toLowerCase().includes(s)
      );
    }
    return {
      questions: list,
      topics: Array.from(new Set(db.questions.map((q) => q.topic))).sort(),
      total: list.length
    };
  },

  'POST /api/questions': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const body = ctx.body ?? {};
    if (!body.title?.trim()) throw new HttpError(400, 'Question title is required.');
    if (!body.prompt?.trim()) throw new HttpError(400, 'Question text is required.');
    const question: Question = {
      id: `Q${String(db.questions.length + 1).padStart(3, '0')}${uid('').slice(-2)}`,
      version: 1,
      title: body.title.trim(),
      type: body.type ?? 'MCQ',
      topic: body.topic ?? 'General',
      difficulty: body.difficulty ?? 'EASY',
      marks: Number(body.marks) || 1,
      status: body.status ?? 'ACTIVE',
      prompt: body.prompt,
      code: body.code,
      options: body.options,
      answer: String(body.answer ?? ''),
      alternatives: body.alternatives,
      explanation: body.explanation,
      inputFormat: body.inputFormat,
      outputFormat: body.outputFormat,
      constraints: body.constraints,
      sampleInput: body.sampleInput,
      sampleOutput: body.sampleOutput,
      testCases: body.testCases,
      createdBy: user.id,
      createdAt: now()
    };
    db.questions.unshift(question);
    audit(user.id, user.role, 'Created question', question.id, question.title);
    return { question };
  },

  'GET /api/questions/:id': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const question = db.questions.find((q) => q.id === ctx.params.id);
    if (!question) throw new HttpError(404, 'Question not found.');
    return { question, versions: db.questionVersions.filter((v) => v.questionId === question.id) };
  },

  'PUT /api/questions/:id': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const question = db.questions.find((q) => q.id === ctx.params.id);
    if (!question) throw new HttpError(404, 'Question not found.');
    const inUse = db.attempts.some((a) => a.questionIds.includes(question.id));
    if (inUse) {
      // Preserve historical exam data by versioning instead of overwriting.
      db.questionVersions.unshift({
        id: uid('QV'),
        questionId: question.id,
        version: question.version,
        snapshot: { ...question },
        changedBy: user.id,
        reason: ctx.body?.reason ?? 'Correction during live test',
        createdAt: now()
      });
      question.version += 1;
    }
    Object.assign(question, ctx.body, { id: question.id, version: question.version });
    audit(user.id, user.role, 'Updated question', question.id, inUse ? `new version v${question.version}` : '');
    return { question };
  },

  'DELETE /api/questions/:id': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const question = db.questions.find((q) => q.id === ctx.params.id);
    if (!question) throw new HttpError(404, 'Question not found.');
    question.status = 'ARCHIVED';
    audit(user.id, user.role, 'Archived question', question.id, question.title);
    return { question };
  },

  'POST /api/questions/:id/duplicate': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const source = db.questions.find((q) => q.id === ctx.params.id);
    if (!source) throw new HttpError(404, 'Question not found.');
    const copy: Question = {
      ...source,
      id: `Q${String(db.questions.length + 1).padStart(3, '0')}${uid('').slice(-2)}`,
      title: `${source.title} (Copy)`,
      version: 1,
      status: 'DRAFT',
      createdBy: user.id,
      createdAt: now()
    };
    db.questions.unshift(copy);
    audit(user.id, user.role, 'Duplicated question', copy.id, source.id);
    return { question: copy };
  },

  // ---------------- LIVE MONITORING ----------------
  'GET /api/staff/live': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const rows = db.attempts.map((attempt) => {
      const answers = db.answers.filter((a) => a.attemptId === attempt.id);
      return {
        attemptId: attempt.id,
        studentId: attempt.studentId,
        name: studentName(attempt.studentId),
        testId: attempt.testId,
        testName: db.tests.find((t) => t.id === attempt.testId)?.name ?? attempt.testId,
        status: attempt.status,
        currentQuestion: attempt.currentQuestion + 1,
        totalQuestions: attempt.questionIds.length,
        answered: answers.filter((a) => a.value.trim()).length,
        locked: answers.filter((a) => a.locked).length,
        lastActivity: attempt.lastActivity,
        securityEvents: db.securityEvents.filter((e) => e.attemptId === attempt.id).length
      };
    });
    return {
      rows,
      stats: {
        total: db.users.filter((u) => u.role === 'STUDENT').length,
        active: rows.filter((r) => r.status === 'IN_PROGRESS').length,
        submitted: rows.filter((r) =>
        ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(r.status)
        ).length,
        locked: rows.filter((r) => r.status === 'LOCKED').length,
        disconnected: rows.filter((r) => r.status === 'DISCONNECTED').length,
        securityEvents: db.securityEvents.length
      },
      serverTime: now()
    };
  },

  'POST /api/staff/students/:id/lock': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const attempt = db.attempts.find((a) => a.studentId === ctx.params.id && a.status === 'IN_PROGRESS');
    if (!attempt) throw new HttpError(404, 'No live attempt found for this student.');
    attempt.status = 'LOCKED';
    attempt.lockedByStaff = user.id;
    attempt.lockReason = ctx.body?.reason ?? 'Locked by examination staff';
    audit(user.id, user.role, 'Locked student', ctx.params.id, attempt.lockReason);
    security('STUDENT_LOCKED', user.id, user.role, `Locked ${ctx.params.id}`, {
      attemptId: attempt.id,
      testId: attempt.testId
    });
    return { ok: true };
  },

  'POST /api/staff/students/:id/unlock': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const attempt = db.attempts.find((a) => a.studentId === ctx.params.id && a.status === 'LOCKED');
    if (!attempt) throw new HttpError(404, 'This student is not locked.');
    attempt.status = 'IN_PROGRESS';
    attempt.lockedByStaff = null;
    attempt.lockReason = null;
    audit(user.id, user.role, 'Unlocked student', ctx.params.id, ctx.body?.reason ?? '');
    security('STUDENT_UNLOCKED', user.id, user.role, `Unlocked ${ctx.params.id}`, {
      attemptId: attempt.id,
      testId: attempt.testId
    });
    return { ok: true };
  },

  'POST /api/staff/students/:id/force-submit': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const attempt = db.attempts.find(
      (a) => a.studentId === ctx.params.id && ['IN_PROGRESS', 'LOCKED'].includes(a.status)
    );
    if (!attempt) throw new HttpError(404, 'No live attempt found for this student.');
    const stored: Record<string, string> = {};
    db.answers.
    filter((a) => a.attemptId === attempt.id).
    forEach((a) => {
      stored[a.questionId] = a.value;
    });
    const result = finalizeAttempt(attempt, stored, 'FORCE_SUBMITTED');
    audit(user.id, user.role, 'Force submitted student', ctx.params.id, `score ${result.score}/${result.maxScore}`);
    return { ok: true, result };
  },

  // ---------------- EDIT REQUESTS ----------------
  'GET /api/staff/edit-requests': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    return {
      requests: db.editRequests.map((r) => ({
        ...r,
        studentName: studentName(r.studentId),
        testName: db.tests.find((t) => t.id === r.testId)?.name ?? r.testId,
        questionTitle: db.questions.find((q) => q.id === r.questionId)?.title ?? r.questionId
      }))
    };
  },

  'POST /api/staff/edit-requests/:id/approve': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const request = db.editRequests.find((r) => r.id === ctx.params.id);
    if (!request) throw new HttpError(404, 'Request not found.');
    if (request.status !== 'PENDING') throw new HttpError(409, 'This request has already been decided.');
    const record = db.answers.find(
      (a) => a.attemptId === request.attemptId && a.questionId === request.questionId
    );
    if (!record) throw new HttpError(404, 'The locked answer no longer exists.');
    record.editGranted = true;
    request.status = 'APPROVED';
    request.decidedBy = user.id;
    request.decidedAt = now();
    audit(user.id, user.role, 'Approved modification', request.studentId, request.questionId);
    security('MODIFICATION_APPROVED', user.id, user.role, `${request.studentId} · ${request.questionId}`, {
      attemptId: request.attemptId,
      testId: request.testId
    });
    return { request };
  },

  'POST /api/staff/edit-requests/:id/deny': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const request = db.editRequests.find((r) => r.id === ctx.params.id);
    if (!request) throw new HttpError(404, 'Request not found.');
    if (request.status !== 'PENDING') throw new HttpError(409, 'This request has already been decided.');
    request.status = 'DENIED';
    request.decidedBy = user.id;
    request.decidedAt = now();
    audit(user.id, user.role, 'Denied modification', request.studentId, request.questionId);
    security('MODIFICATION_DENIED', user.id, user.role, `${request.studentId} · ${request.questionId}`, {
      attemptId: request.attemptId,
      testId: request.testId
    });
    return { request };
  },

  // ---------------- RESULTS / LOGS ----------------
  'GET /api/results': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const { testId, search, status } = ctx.query;
    let list = db.results.map((r) => ({
      ...r,
      studentName: studentName(r.studentId),
      testName: db.tests.find((t) => t.id === r.testId)?.name ?? r.testId,
      attemptStatus: db.attempts.find((a) => a.id === r.attemptId)?.status ?? 'SUBMITTED'
    }));
    if (testId) list = list.filter((r) => r.testId === testId);
    if (status === 'PUBLISHED') list = list.filter((r) => r.published);
    if (status === 'HIDDEN') list = list.filter((r) => !r.published);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (r) => r.studentId.toLowerCase().includes(s) || r.studentName.toLowerCase().includes(s)
      );
    }
    return { results: list };
  },

  'GET /api/results/:id': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN', 'STUDENT');
    const result = db.results.find((r) => r.id === ctx.params.id);
    if (!result) throw new HttpError(404, 'Result not found.');
    if (user.role === 'STUDENT' && (result.studentId !== user.id || !result.published)) {
      throw new HttpError(403, 'You do not have permission to view this result.');
    }
    return {
      result: {
        ...result,
        studentName: studentName(result.studentId),
        testName: db.tests.find((t) => t.id === result.testId)?.name ?? result.testId
      }
    };
  },

  'POST /api/results/publish': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const { testId, published } = ctx.body ?? {};
    const test = getTest(testId);
    test.resultsPublished = Boolean(published);
    db.results.filter((r) => r.testId === testId).forEach((r) => {
      r.published = Boolean(published);
    });
    audit(
      user.id,
      user.role,
      published ? 'Published results' : 'Hid results',
      test.name,
      `${db.results.filter((r) => r.testId === testId).length} results`
    );
    return { ok: true };
  },

  'GET /api/staff/security-events': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const { type, search } = ctx.query;
    let list = [...db.securityEvents];
    if (type) list = list.filter((e) => e.type === type);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (e) => e.actor.toLowerCase().includes(s) || e.detail.toLowerCase().includes(s)
      );
    }
    return { events: list, types: Array.from(new Set(db.securityEvents.map((e) => e.type))).sort() };
  },

  'GET /api/staff/audit-logs': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const { search } = ctx.query;
    let list = [...db.auditLogs];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (l) =>
        l.actor.toLowerCase().includes(s) ||
        l.action.toLowerCase().includes(s) ||
        l.target.toLowerCase().includes(s)
      );
    }
    return { logs: list };
  }
};