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
    const scheduledStart = ctx.body?.scheduledStart ?? test.scheduledStart;
    if (!scheduledStart) throw new HttpError(400, 'Choose a scheduled start time before publishing this test.');
    transition(test, 'SCHEDULED');
    test.scheduledStart = scheduledStart;
    audit(user.id, user.role, 'Scheduled test', test.name, String(test.scheduledStart ?? ''));
    return { test };
  },

  'POST /api/staff/tests/:id/start': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    if (!test.scheduledStart) throw new HttpError(400, 'Set a scheduled start time before making this test live.');
    if (new Date(String(test.scheduledStart).replace(' ', 'T')).getTime() > Date.now()) {
      throw new HttpError(409, `This test does not start until ${test.scheduledStart}.`);
    }
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
    for (let i = db.testQuestions.length - 1; i >= 0; i -= 1) {
      if (db.testQuestions[i].questionId === question.id) db.testQuestions.splice(i, 1);
    }
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

  // ---------------- QUESTIONS INSIDE A TEST ----------------
  'GET /api/staff/tests/:id/questions': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    getTest(ctx.params.id);
    const links = db.testQuestions.
    filter((l) => l.testId === ctx.params.id).
    sort((a, b) => a.position - b.position);
    const questions = links.
    map((l) => db.questions.find((q) => q.id === l.questionId)).
    filter((q): q is Question => Boolean(q));
    return { questions, total: questions.length, totalMarks: questions.reduce((s, q) => s + (q.marks ?? 0), 0) };
  },

  'POST /api/staff/tests/:id/questions': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    if (!['DRAFT', 'SCHEDULED'].includes(test.status)) {
      throw new HttpError(409, 'Questions can only be added while the test is not live.');
    }
    const body = ctx.body ?? {};
    const prompt = String(body.question ?? body.prompt ?? '');
    if (!prompt.trim()) throw new HttpError(400, 'Question text is required.');
    const qtype = String(body.type ?? 'MCQ');
    if (!['MCQ', 'TRUE_FALSE', 'FILL_BLANK', 'OUTPUT', 'CODE_COMPLETION', 'DEBUGGING', 'CODING'].includes(qtype)) {
      throw new HttpError(400, `Unknown question type: ${qtype}`);
    }
    const marks = Number(body.marks ?? 1);
    if (!Number.isFinite(marks) || marks < 1 || marks > 100) {
      throw new HttpError(400, 'Marks must be a whole number between 1 and 100.');
    }
    const question: Question = {
      id: `Q${String(db.questions.length + 1).padStart(3, '0')}${uid('').slice(-2)}`,
      version: 1,
      title: String(body.title ?? '').trim() || prompt.slice(0, 80),
      type: qtype as Question['type'],
      topic: String(body.topic ?? 'General'),
      difficulty: String(body.difficulty ?? 'EASY') as Question['difficulty'],
      marks,
      status: 'ACTIVE',
      prompt,
      code: body.code ?? undefined,
      options: Array.isArray(body.options) ? body.options : undefined,
      answer: String(body.answer ?? body.correctAnswer ?? ''),
      alternatives: Array.isArray(body.alternatives) ? body.alternatives : undefined,
      explanation: body.explanation ?? undefined,
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
    const next = Math.max(0, ...db.testQuestions.filter((l) => l.testId === test.id).map((l) => l.position)) + 1;
    db.testQuestions.push({ testId: test.id, questionId: question.id, position: next });
    audit(user.id, user.role, 'Created question', question.id, question.title);
    return { question };
  },

  'POST /api/staff/tests/:id/questions/import': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const test = getTest(ctx.params.id);
    if (!['DRAFT', 'SCHEDULED'].includes(test.status)) {
      throw new HttpError(409, 'Questions can only be added while the test is not live.');
    }
    const rows = Array.isArray(ctx.body?.rows) ? ctx.body.rows : [];
    if (rows.length === 0) throw new HttpError(400, 'No questions to import.');
    const typeMap: Record<string, string> = {
      MCQ: 'MCQ',
      TRUE_FALSE: 'TRUE_FALSE',
      FILL_BLANK: 'FILL_BLANK',
      OUTPUT_PREDICTION: 'OUTPUT',
      OUTPUT: 'OUTPUT',
      CODE_COMPLETION: 'CODE_COMPLETION',
      DEBUGGING: 'DEBUGGING',
      CODING: 'CODING',
      SHORT_ANSWER: 'FILL_BLANK'
    };
    const imported: string[] = [];
    const errors: { line: number; message: string }[] = [];
    rows.forEach((raw: Record<string, unknown>, index: number) => {
      const line = index + 1;
      try {
        const r = raw ?? {};
        const prompt = String(r.question ?? r.prompt ?? '').trim();
        if (!prompt) throw new Error(`Row ${line}: "question" is required.`);
        const qtype = typeMap[String(r.type ?? '').trim().toUpperCase()];
        if (!qtype) throw new Error(`Row ${line}: unknown question type "${String(r.type ?? '')}".`);
        const marks = Number(r.marks ?? 1);
        if (!Number.isFinite(marks) || marks < 1) throw new Error(`Row ${line}: "marks" must be a whole number.`);
        const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(String(r.difficulty ?? '').toUpperCase())
          ? String(r.difficulty).toUpperCase()
          : 'EASY';
        const options = [r.option_a, r.option_b, r.option_c, r.option_d].
        filter((o) => String(o ?? '').trim() !== '').
        map((o) => String(o));
        const keywords = String(r.keywords ?? '').split(',').map((k) => k.trim()).filter(Boolean);
        const expected = String(r.expected_output ?? r.answer ?? r.correctAnswer ?? '').trim();
        let answer = '';
        if (qtype === 'MCQ') {
          if (options.length < 2) throw new Error(`Row ${line}: MCQ questions need at least two options.`);
          const correct = String(r.correct_answer ?? r.correctAnswer ?? '').trim();
          if (/^[A-D]$/i.test(correct)) answer = String((correct.toUpperCase().charCodeAt(0) - 65) % 4);
          else if (correct) {
            const idx = options.findIndex((o) => o.toLowerCase() === correct.toLowerCase());
            answer = idx >= 0 ? String(idx) : correct;
          } else throw new Error(`Row ${line}: MCQ questions need a correct answer (A–D or the option text).`);
        } else if (qtype === 'TRUE_FALSE') {
          answer = ['true', 't', 'yes', '1'].includes(String(r.correct_answer ?? r.correctAnswer ?? '').trim().toLowerCase())
            ? 'true'
            : 'false';
        } else {
          answer = expected || String(r.correct_answer ?? r.correctAnswer ?? '');
          if (!answer) throw new Error(`Row ${line}: a correct answer is required for ${qtype} questions.`);
        }
        const body = {
          question: prompt,
          title: String(r.title ?? '').trim() || prompt.slice(0, 80),
          type: qtype,
          marks,
          topic: String(r.topic ?? '').trim() || 'General',
          difficulty,
          options: options.length ? options : undefined,
          answer,
          alternatives: keywords,
          explanation: String(r.explanation ?? '').trim() || undefined
        };
        const question: Question = {
          id: `Q${String(db.questions.length + 1).padStart(3, '0')}${uid('').slice(-2)}`,
          version: 1,
          title: body.title,
          type: body.type as Question['type'],
          topic: body.topic,
          difficulty: body.difficulty as Question['difficulty'],
          marks,
          status: 'ACTIVE',
          prompt,
          code: undefined,
          options: body.options ?? undefined,
          answer,
          alternatives: body.alternatives,
          explanation: body.explanation,
          createdBy: user.id,
          createdAt: now()
        };
        db.questions.unshift(question);
        const next = Math.max(0, ...db.testQuestions.filter((l) => l.testId === test.id).map((l) => l.position)) + 1;
        db.testQuestions.push({ testId: test.id, questionId: question.id, position: next });
        imported.push(question.id);
      } catch (error) {
        errors.push({ line, message: error instanceof Error ? error.message : String(error) });
      }
    });
    audit(user.id, user.role, 'Imported questions', test.name, `${imported.length} imported, ${errors.length} errors`);
    const links = db.testQuestions.
    filter((l) => l.testId === test.id).
    sort((a, b) => a.position - b.position);
    const questions = links.
    map((l) => db.questions.find((q) => q.id === l.questionId)).
    filter((q): q is Question => Boolean(q));
    return {
      imported: imported.length,
      errors,
      total: questions.length,
      totalMarks: questions.reduce((s, q) => s + (q.marks ?? 0), 0),
      questions
    };
  },

  'PUT /api/staff/tests/:id/questions': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const orderedIds = ctx.body?.orderedIds;
    if (!Array.isArray(orderedIds)) throw new HttpError(400, 'An orderedIds array is required.');
    const owned = new Set(db.testQuestions.filter((l) => l.testId === ctx.params.id).map((l) => l.questionId));
    for (const qid of orderedIds) {
      if (!owned.has(String(qid))) throw new HttpError(400, `Question ${qid} does not belong to this test.`);
    }
    orderedIds.forEach((qid, i) => {
      const link = db.testQuestions.find((l) => l.testId === ctx.params.id && l.questionId === String(qid));
      if (link) link.position = i + 1;
    });
    audit(user.id, user.role, 'Reordered questions', ctx.params.id, '');
    return { ok: true };
  },

  // ---------------- LIVE MONITORING ----------------
  'GET /api/staff/live': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const testId = ctx.query.testId;
    const attempts = testId ? db.attempts.filter((a) => a.testId === testId) : db.attempts;
    const rows = attempts.map((attempt) => {
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
    const testObj = testId ? db.tests.find((t) => t.id === testId) ?? null : null;
    return {
      rows,
      test: testObj,
      stats: {
        total: db.users.filter((u) => u.role === 'STUDENT').length,
        active: rows.filter((r) => r.status === 'IN_PROGRESS').length,
        submitted: rows.filter((r) =>
        ['SUBMITTED', 'FORCE_SUBMITTED', 'TIME_EXPIRED'].includes(r.status)
        ).length,
        locked: rows.filter((r) => r.status === 'LOCKED').length,
        disconnected: rows.filter((r) => r.status === 'DISCONNECTED').length,
        securityEvents: testId
          ? db.securityEvents.filter((e) => e.testId === testId).length
          : db.securityEvents.length,
        pendingEdit: testId
          ? db.editRequests.filter((r) => r.status === 'PENDING' && r.testId === testId).length
          : db.editRequests.filter((r) => r.status === 'PENDING').length,
        activeTests: testId
          ? (testObj?.status === 'ACTIVE' ? 1 : 0)
          : db.tests.filter((t) => t.status === 'ACTIVE').length
      },
      serverTime: now()
    };
  },

  // ---------------- STUDENT ROSTER ----------------
  'GET /api/staff/students': (ctx) => {
    requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    let students = db.users.filter((u) => u.role === 'STUDENT');
    const search = ctx.query.search;
    if (search) {
      const s = search.toLowerCase();
      students = students.filter((u) => u.id.toLowerCase().includes(s) || u.name.toLowerCase().includes(s));
    }
    const rows = students.map((u) => {
      const latest = [...db.attempts].
      filter((a) => a.studentId === u.id).
      sort((a, b) => String(a.lastActivity).localeCompare(String(b.lastActivity))).
      reverse()[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        active: u.active,
        takenTests: new Set(db.attempts.filter((a) => a.studentId === u.id).map((a) => a.testId)).size,
        currentStatus: latest?.status ?? 'NOT_STARTED',
        currentTest: latest ? db.tests.find((t) => t.id === latest.testId)?.name ?? latest.testId : null,
        lastActivity: latest?.lastActivity ?? null
      };
    });
    return {
      total: rows.length,
      activeCount: rows.filter((r) => r.active).length,
      students: rows
    };
  },

  'POST /api/staff/students/:id/lock': (ctx) => {
    const user = requireRole(ctx, 'STAFF', 'SUPER_ADMIN');
    const attempt = db.attempts.find((a) => a.studentId === ctx.params.id && a.status === 'IN_PROGRESS');
    if (!attempt) throw new HttpError(404, 'No live attempt found for this student.');
    attempt.status = 'LOCKED';
    attempt.lockedByStaff = user.id;
    attempt.lockReason = ctx.body?.reason ?? 'Locked by examination staff';
    audit(user.id, user.role, 'Locked student', ctx.params.id, attempt.lockReason ?? undefined);
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