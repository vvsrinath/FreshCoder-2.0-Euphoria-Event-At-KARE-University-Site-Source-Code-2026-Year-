/** Student routes (mirrors src/backend/routes/student_routes.py). */
import crypto from "node:crypto";
import { ApiError, HttpResponse, ok } from "../http";
import { execute, query, queryOne, str, num, securityEvent, type Row } from "../db";
import { gradeAnswer } from "../grading";
import { RouteCtx, RouteDef } from "../router";
import { loads, parseUtc, shuffle, utcNow } from "../utils";
import { verifyPassword } from "../auth";

const FINAL_STATES = ["SUBMITTED", "FORCE_SUBMITTED", "TIME_EXPIRED"];

function uuidHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex").toUpperCase();
}

function deadlineExpired(attempt: Row): boolean {
  const raw = attempt["deadline"] === undefined ? null : attempt["deadline"];
  const deadline = parseUtc(raw === null || raw === undefined ? null : str(raw));
  return deadline !== undefined && deadline.getTime() < Date.now();
}

/** The server selects and shuffles the question set — never the browser. */
async function selectQuestionIds(test: Row): Promise<string[]> {
  // Questions live inside each test (test_questions). When a test has its own set,
  // the pool is ONLY that set — never the whole bank. Older tests without a set
  // fall back to the global active pool for backward compatibility.
  const owned = await query("SELECT question_id FROM test_questions WHERE test_id = ?", [test["id"]]);
  const ownedIds = owned.map((r) => str(r["question_id"]));
  const active = ownedIds.length
    ? await query(
        "SELECT id, type FROM questions WHERE status = 'ACTIVE' AND id IN (" + ownedIds.map(() => "?").join(",") + ")",
        ownedIds
      )
    : await query("SELECT id, type FROM questions WHERE status = 'ACTIVE'");
  const mode = str(test["selection_mode"]);
  const questionCount = num(test["question_count"]);
  let picked: string[] = [];

  if (mode === "MANUAL") {
    const manual = (loads(str(test["manual_question_ids"]), []) as unknown[]) as string[];
    const available = new Set(active.map((row) => str(row["id"])));
    picked = manual.filter((qid) => available.has(qid)).slice(0, questionCount);
  } else if (mode === "DISTRIBUTION") {
    const distribution = loads(str(test["distribution"]), {}) as Record<string, unknown>;
    for (const [qtype, count] of Object.entries(distribution)) {
      const wanted = Math.max(0, Number(count) || 0);
      const pool = active.filter((row) => str(row["type"]) === qtype).map((row) => str(row["id"]));
      picked.push(...shuffle(pool).slice(0, wanted));
    }
    if (picked.length < questionCount) {
      const filler = active
        .filter((row) => !picked.includes(str(row["id"])))
        .map((row) => str(row["id"]));
      picked.push(...shuffle(filler).slice(0, questionCount - picked.length));
    }
    picked = shuffle(picked).slice(0, questionCount);
  } else {
    let pool = active.map((row) => str(row["id"]));
    const testType = str(test["type"]);
    if (testType !== "MIXED" && testType !== "QUIZ" && !ownedIds.length) {
      const typed = active.filter((row) => str(row["type"]) === testType).map((row) => str(row["id"]));
      pool = typed.length ? typed : pool;
    }
    picked = shuffle(pool).slice(0, questionCount);
  }

  return picked;
}

/** Never ship answers or explanations to a student. */
function sanitizeQuestion(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    version: row["version"],
    title: row["title"],
    type: row["type"],
    topic: row["topic"],
    difficulty: row["difficulty"],
    marks: row["marks"],
    prompt: row["prompt"],
    code: row["code"],
    options: loads(str(row["options"]), null),
    inputFormat: row["input_format"],
    outputFormat: row["output_format"],
    constraints: row["constraints"],
    sampleInput: row["sample_input"],
    sampleOutput: row["sample_output"],
  };
}

/** Snapshot each question exactly as it was when the attempt started. */
async function freezeStartedQuestions(attempt: Row): Promise<void> {
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [attempt["test_id"]]);
  const shuffleOptions = test !== undefined && str(test["selection_mode"]) === "RANDOM";
  const ids = (loads(str(attempt["question_ids"]), []) as unknown[]) as string[];
  if (ids.length === 0) return;
  const rows = await query(
    "SELECT * FROM questions WHERE id IN (" + ids.map(() => "?").join(",") + ")",
    ids
  );
  const byId = new Map(rows.map((r) => [str(r["id"]), r]));
  const values: unknown[] = [];
  for (const questionId of ids) {
    const row = byId.get(questionId);
    if (row === undefined) continue;
    const snapshot = { ...row };
    if (shuffleOptions && str(row["type"]) === "MCQ") {
      const options = loads(str(row["options"]), []) as string[];
      if (options.length > 1) {
        const indexed = options.map((option, index) => ({ option, index }));
        for (let i = indexed.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
        }
        const correct = Number(str(row["answer"]));
        snapshot["options"] = JSON.stringify(indexed.map((entry) => entry.option));
        if (Number.isInteger(correct) && correct >= 0 && correct < options.length) {
          snapshot["answer"] = String(indexed.findIndex((entry) => entry.index === correct));
        }
      }
    }
    values.push(attempt["id"], questionId, row["version"], JSON.stringify(snapshot));
  }
  if (values.length > 0) {
    const rows_ = values.length / 4;
    await execute(
      "INSERT OR IGNORE INTO frozen_questions (attempt_id, question_id, version, snapshot) VALUES " +
        new Array(rows_).fill("(?, ?, ?, ?)").join(", "),
      values
    );
  }
}

/**
 * Fetch every frozen snapshot for an attempt in one round trip, falling back
 * to live question rows for any question that was never frozen.
 */
async function frozenQuestionsBatch(attempt: Row, questionIds: string[]): Promise<Map<string, Row>> {
  const map = new Map<string, Row>();
  if (questionIds.length === 0) return map;
  const seen = new Set(questionIds);
  const rows = await query("SELECT question_id, snapshot FROM frozen_questions WHERE attempt_id = ?", [
    attempt["id"],
  ]);
  const missing: string[] = [];
  for (const r of rows) {
    const qid = str(r["question_id"]);
    if (!seen.has(qid)) continue;
    try {
      map.set(qid, JSON.parse(str(r["snapshot"])) as Row);
    } catch {
      missing.push(qid);
    }
  }
  for (const qid of seen) {
    if (!map.has(qid)) missing.push(qid);
  }
  if (missing.length > 0) {
    const live = await query(
      "SELECT * FROM questions WHERE id IN (" + missing.map(() => "?").join(",") + ")",
      missing
    );
    for (const r of live) map.set(str(r["id"]), r);
  }
  return map;
}

async function attemptPayload(attempt: Row): Promise<Record<string, unknown>> {
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [attempt["test_id"]]);
  const questionIds = (loads(str(attempt["question_ids"]), []) as unknown[]) as string[];
  const frozen = await frozenQuestionsBatch(attempt, questionIds);
  const questions: Record<string, unknown>[] = [];
  for (const qid of questionIds) {
    const row = frozen.get(qid);
    if (row) questions.push(sanitizeQuestion(row));
  }
  const answers = await query("SELECT * FROM answers WHERE attempt_id = ?", [attempt["id"]]);
  return {
    attempt: {
      id: attempt["id"],
      testId: attempt["test_id"],
      status: attempt["status"],
      startedAt: attempt["started_at"],
      deadline: attempt["deadline"],
      currentQuestion: attempt["current_question"],
      lockedByStaff: attempt["locked_by_staff"],
      lockReason: attempt["lock_reason"],
    },
    test: {
      id: test?.["id"],
      name: test?.["name"],
      type: test?.["type"],
      status: test?.["status"],
      durationMinutes: test?.["duration_minutes"],
      questionCount: questionIds.length,
    },
    questions,
    answers: answers.map((a) => ({
      questionId: a["question_id"],
      value: a["value"] ?? "",
      locked: Number(a["locked"]) === 1,
      editGranted: Number(a["edit_granted"]) === 1,
    })),
    serverTime: utcNow(),
  };
}

async function storedAnswers(attempt: Row): Promise<Record<string, string>> {
  const rows = await query("SELECT * FROM answers WHERE attempt_id = ?", [attempt["id"]]);
  const out: Record<string, string> = {};
  for (const r of rows) out[str(r["question_id"])] = str(r["value"]);
  return out;
}

export async function finalizeAttempt(
  attempt: Row,
  incoming: Record<string, unknown>,
  reason: string
): Promise<Record<string, unknown>> {
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [attempt["test_id"]]);
  const questionIds = (loads(str(attempt["question_ids"]), []) as unknown[]) as string[];

  const existingAnswers = await query(
    "SELECT question_id, value, locked, edit_granted FROM answers WHERE attempt_id = ?",
    [attempt["id"]]
  );
  const existingMap = new Map(existingAnswers.map((r) => [str(r["question_id"]), r]));
  const wrote = new Set<string>();
  const inserts: [string, string][] = [];
  const updates: [string, string][] = [];
  for (const questionId of questionIds) {
    const value = incoming[questionId];
    if (value === null || value === undefined || typeof value !== "string") continue;
    const existing = existingMap.get(questionId);
    if (existing === undefined) {
      inserts.push([questionId, value.slice(0, 10000)]);
    } else if (Number(existing["locked"]) === 0 || Number(existing["edit_granted"]) === 1) {
      updates.push([questionId, value.slice(0, 10000)]);
    }
  }
  if (inserts.length > 0) {
    const now = utcNow();
    const params: unknown[] = [];
    for (const [qid, val] of inserts) params.push(attempt["id"], qid, val, now);
    await execute(
      "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at) VALUES " +
        new Array(inserts.length).fill("(?, ?, ?, 1, 0, ?)").join(", "),
      params
    );
    for (const [qid] of inserts) wrote.add(qid);
  }
  for (const [qid, val] of updates) {
    await execute(
      "UPDATE answers SET value = ?, locked = 1, edit_granted = 0, updated_at = ? WHERE attempt_id = ? AND question_id = ?",
      [val, utcNow(), attempt["id"], qid]
    );
    wrote.add(qid);
  }

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;
  let score = 0;
  let maxScore = 0;
  const breakdown: Record<string, unknown>[] = [];

  const frozen = await frozenQuestionsBatch(attempt, questionIds);
  for (const questionId of questionIds) {
    const question = frozen.get(questionId);
    if (!question) continue;
    maxScore += num(question["marks"]);
    const given = wrote.has(questionId)
      ? String(incoming[questionId] ?? "")
      : str(existingMap.get(questionId)?.["value"] ?? "");
    if (!given.trim()) {
      unanswered += 1;
      breakdown.push({
        questionId,
        type: question["type"],
        marks: question["marks"],
        awarded: 0,
        correct: false,
        given: "",
      });
      continue;
    }
    const { correct: isCorrect, awarded } = gradeAnswer(
      { marks: question["marks"], type: str(question["type"]), answer: question["answer"] === null ? null : str(question["answer"]), alternatives: question["alternatives"] },
      given
    );
    score += awarded;
    if (isCorrect === true) correct += 1;
    else wrong += 1;
    breakdown.push({
      questionId,
      type: question["type"],
      marks: question["marks"],
      awarded,
      correct: isCorrect,
      given,
    });
  }

  const submittedAt = utcNow();
  const started = parseUtc(str(attempt["started_at"])) ?? new Date();
  const timeUsed = Math.max(0, Math.floor((Date.now() - started.getTime()) / 1000));
  const statusMap: Record<string, string> = { FORCE_SUBMITTED: "FORCE_SUBMITTED", TIME_EXPIRED: "TIME_EXPIRED" };
  const status = statusMap[reason] ?? "SUBMITTED";

  await execute(
    "UPDATE attempts SET status = ?, submitted_at = ?, last_activity = ?, session_token = NULL WHERE id = ?",
    [status, submittedAt, submittedAt, attempt["id"]]
  );

  const total = questionIds.length;
  const attempted = total - unanswered;
  const percentage = maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0;
  const resultId = `RS${uuidHex(10)}`;
  await execute("DELETE FROM results WHERE attempt_id = ?", [attempt["id"]]);
  await execute(
    "INSERT INTO results (id, attempt_id, test_id, student_id, total_questions, attempted, correct, wrong, unanswered, score, max_score, percentage, time_used_seconds, submitted_at, published, breakdown) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      resultId,
      attempt["id"],
      attempt["test_id"],
      attempt["student_id"],
      total,
      attempted,
      correct,
      wrong,
      unanswered,
      score,
      maxScore,
      percentage,
      timeUsed,
      submittedAt,
      Number(test?.["practice"]) === 1 || Number(test?.["results_published"]) === 1 ? 1 : 0,
      JSON.stringify(breakdown),
    ]
  );
  await securityEvent(
    status === "FORCE_SUBMITTED" ? "FORCE_SUBMITTED" : "TEST_SUBMITTED",
    str(attempt["student_id"]),
    "STUDENT",
    `${test?.["name"]} finalised (${status})`,
    str(attempt["test_id"]),
    str(attempt["id"])
  );
  return {
    id: resultId,
    score,
    maxScore,
    percentage,
    published: Number(test?.["practice"]) === 1 || Number(test?.["results_published"]) === 1,
  };
}

/** Assignment gating: if rows exist for a test, only assigned students may take it. */
async function isAssigned(testId: string, studentId: string): Promise<boolean> {
  const assigned = await queryOne("SELECT 1 FROM student_test_assignments WHERE test_id = ? AND student_id = ?", [
    testId,
    studentId,
  ]);
  if (assigned) return true;
  const anyAssignment = await queryOne("SELECT 1 FROM student_test_assignments WHERE test_id = ? LIMIT 1", [testId]);
  return !anyAssignment;
}

function assignedFromSets(testId: string, studentId: string, testHasAssignments: Set<string>, studentAssigned: Set<string>): boolean {
  return studentAssigned.has(testId) || !testHasAssignments.has(testId);
}

async function assignedTests(studentId: string): Promise<Record<string, unknown>[]> {
  const rows = await query(
    "SELECT * FROM tests WHERE status IN ('SCHEDULED','ACTIVE','PAUSED','COMPLETED') ORDER BY scheduled_start IS NULL, scheduled_start"
  );
  const testIds = rows.map((t) => str(t["id"]));
  const testHasAssignments = new Set<string>();
  const studentAssigned = new Set<string>();
  let attemptMap = new Map<string, Row>();
  let resultMap = new Map<string, Row>();
  if (testIds.length > 0) {
    const placeholders = testIds.map(() => "?").join(",");
    const assignments = await query(
      `SELECT test_id, student_id FROM student_test_assignments WHERE test_id IN (${placeholders})`,
      testIds
    );
    for (const a of assignments) {
      testHasAssignments.add(str(a["test_id"]));
      if (str(a["student_id"]) === studentId) studentAssigned.add(str(a["test_id"]));
    }
    const attempts = await query(
      `SELECT * FROM attempts WHERE test_id IN (${placeholders}) AND student_id = ?`,
      [...testIds, studentId]
    );
    attemptMap = new Map(attempts.map((a) => [str(a["test_id"]), a]));
    const results = await query(
      `SELECT * FROM results WHERE test_id IN (${placeholders}) AND student_id = ?`,
      [...testIds, studentId]
    );
    resultMap = new Map(results.map((r) => [str(r["test_id"]), r]));
  }
  const out: Record<string, unknown>[] = [];
  for (const test of rows) {
    const status = str(test["status"]);
    if (
      (status === "ACTIVE" || status === "PAUSED" || status === "COMPLETED") &&
      !assignedFromSets(str(test["id"]), studentId, testHasAssignments, studentAssigned)
    ) {
      continue;
    }
    const attempt = attemptMap.get(str(test["id"]));
    const result = resultMap.get(str(test["id"]));
    out.push({
      id: test["id"],
      name: test["name"],
      description: test["description"],
      type: test["type"],
      eventId: test["event_id"],
      questionCount: test["question_count"],
      durationMinutes: test["duration_minutes"],
      scheduledStart: test["scheduled_start"],
      status,
      practice: num(test["practice"]) === 1,
      attemptStatus: attempt ? attempt["status"] : "NOT_STARTED",
      attemptId: attempt ? attempt["id"] : null,
      resultAvailable: Boolean(result && Number(result["published"]) === 1),
    });
  }
  return out;
}

async function ownAttemptOr403(attemptId: string, userId: string): Promise<Row> {
  const attempt = await queryOne("SELECT * FROM attempts WHERE id = ?", [attemptId]);
  if (attempt === undefined) throw new ApiError(404, "Attempt not found.");
  if (str(attempt["student_id"]) !== userId) {
    await securityEvent("UNAUTHORIZED_ACCESS", userId, "STUDENT", `Tried to open ${attemptId}`);
    throw new ApiError(403, "You do not have permission to view this attempt.");
  }
  return attempt;
}

async function dashboard(ctx: RouteCtx): Promise<HttpResponse> {
  const results = await query(
    "SELECT r.*, t.name AS test_name FROM results r JOIN tests t ON t.id = r.test_id WHERE r.student_id = ? AND r.published = 1",
    [ctx.user.id]
  );
  const event = await queryOne("SELECT * FROM events ORDER BY start_date LIMIT 1");
  return ok({
    student: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
    event: event ? event : null,
    tests: await assignedTests(ctx.user.id),
    results: results.map((r) => ({
      id: r["id"],
      testId: r["test_id"],
      testName: r["test_name"],
      score: r["score"],
      maxScore: r["max_score"],
      percentage: r["percentage"],
      submittedAt: r["submitted_at"],
    })),
    serverTime: utcNow(),
  });
}

async function listTests(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ tests: await assignedTests(ctx.user.id), serverTime: utcNow() });
}

async function getTest(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.params[0];
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [testId]);
  if (test === undefined) throw new ApiError(404, "Test is not available.");
  const status = str(test["status"]);
  if (
    (status === "ACTIVE" || status === "PAUSED" || status === "COMPLETED") &&
    !(await isAssigned(testId, ctx.user.id))
  ) {
    throw new ApiError(404, "Test is not available.");
  }
  const attempt = await queryOne("SELECT * FROM attempts WHERE test_id = ? AND student_id = ?", [testId, ctx.user.id]);
  return ok({
    test: {
      id: test["id"],
      name: test["name"],
      description: test["description"],
      type: test["type"],
      questionCount: test["question_count"],
      durationMinutes: test["duration_minutes"],
      scheduledStart: test["scheduled_start"],
      status,
      practice: num(test["practice"]) === 1,
      startedAt: test["started_at"],
    },
    attemptStatus: attempt ? attempt["status"] : "NOT_STARTED",
    attemptId: attempt ? attempt["id"] : null,
    serverTime: utcNow(),
  });
}

async function startTest(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.params[0];
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [testId]);
  if (test === undefined) throw new ApiError(404, "Test is not available.");
  const status = str(test["status"]);
  if (status === "COMPLETED" || status === "ARCHIVED") throw new ApiError(409, "This test has already ended.");
  if (status !== "ACTIVE") {
    throw new ApiError(409, "The test has not been started by examination staff yet.");
  }
  if (!(await isAssigned(testId, ctx.user.id))) throw new ApiError(403, "You are not enrolled in this test.");
  const scheduled = parseUtc(str(test["scheduled_start"]));
  const practice = num(test["practice"]) === 1;
  if (scheduled && !practice && scheduled.getTime() > Date.now()) throw new ApiError(409, "This test has not started yet.");

  let attempt = await queryOne("SELECT * FROM attempts WHERE test_id = ? AND student_id = ?", [testId, ctx.user.id]);

  if (attempt === undefined) {
    const started = new Date();
    const deadline = new Date(started.getTime() + num(test["duration_minutes"]) * 60_000);
    const attemptId = `AT${uuidHex(10)}`;
    await execute(
      "INSERT INTO attempts (id, test_id, student_id, status, question_ids, started_at, deadline, current_question, last_activity, session_token) VALUES (?, ?, ?, 'IN_PROGRESS', ?, ?, ?, 0, ?, ?)",
      [
        attemptId,
        testId,
        ctx.user.id,
        JSON.stringify(await selectQuestionIds(test)),
        started.toISOString(),
        deadline.toISOString(),
        utcNow(),
        ctx.token,
      ]
    );
    await securityEvent("TEST_STARTED", ctx.user.id, "STUDENT", `Started ${test["name"]}`, testId, attemptId);
    attempt = await queryOne("SELECT * FROM attempts WHERE id = ?", [attemptId]);
    if (attempt) await freezeStartedQuestions(attempt);
  } else {
    const attemptStatus = str(attempt["status"]);
    if (FINAL_STATES.includes(attemptStatus)) throw new ApiError(409, "You have already submitted this test.");
    if (attempt["session_token"] && String(attempt["session_token"]) !== ctx.token) {
      await securityEvent(
        "MULTIPLE_SESSION_DETECTED",
        ctx.user.id,
        "STUDENT",
        "Attempt resumed from a different session",
        testId,
        str(attempt["id"])
      );
    }
    await execute("UPDATE attempts SET session_token = ?, last_activity = ? WHERE id = ?", [ctx.token, utcNow(), attempt["id"]]);
    attempt = await queryOne("SELECT * FROM attempts WHERE id = ?", [str(attempt["id"])]);
  }

  return ok(await attemptPayload(attempt as Row));
}

async function getAttempt(ctx: RouteCtx): Promise<HttpResponse> {
  const attempt = await ownAttemptOr403(ctx.params[0], ctx.user.id);
  await freezeStartedQuestions(attempt);
  return ok(await attemptPayload(attempt));
}

async function lockAnswer(ctx: RouteCtx): Promise<HttpResponse> {
  const attemptId = ctx.params[0];
  const attempt = await ownAttemptOr403(attemptId, ctx.user.id);
  const status = str(attempt["status"]);
  if (FINAL_STATES.includes(status)) throw new ApiError(409, "This attempt is no longer editable.");
  if (status === "LOCKED") throw new ApiError(409, "Your attempt is locked by staff.");
  if (deadlineExpired(attempt)) {
    await finalizeAttempt(attempt, await storedAnswers(attempt), "TIME_EXPIRED");
    throw new ApiError(409, "Your time has expired. The test was submitted automatically.");
  }

  const questionId = str(ctx.body["questionId"] ?? "");
  const value = ctx.body["value"];
  if (typeof value !== "string") throw new ApiError(400, "Answers must be text.");
  if (value.length > 10000) throw new ApiError(400, "Answer is too long.");
  const questionIds = (loads(str(attempt["question_ids"]), []) as unknown[]) as string[];
  if (!questionIds.includes(questionId)) throw new ApiError(400, "That question is not part of your attempt.");

  const existing = await queryOne("SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?", [attemptId, questionId]);
  if (existing && Number(existing["locked"]) === 1 && Number(existing["edit_granted"]) === 0) {
    throw new ApiError(409, "This answer is locked. Request a modification to change it.");
  }

  if (existing) {
    await execute(
      "UPDATE answers SET value = ?, locked = 1, edit_granted = 0, updated_at = ? WHERE attempt_id = ? AND question_id = ?",
      [value, utcNow(), attemptId, questionId]
    );
  } else {
    await execute(
      "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at) VALUES (?, ?, ?, 1, 0, ?)",
      [attemptId, questionId, value, utcNow()]
    );
  }
  await execute("UPDATE attempts SET last_activity = ? WHERE id = ?", [utcNow(), attemptId]);
  await securityEvent("ANSWER_LOCKED", ctx.user.id, "STUDENT", `Locked ${questionId}`, str(attempt["test_id"]), attemptId);
  return ok({ ok: true, questionId, locked: true });
}

async function heartbeatPayload(attempt: Row, autoSubmitted = false): Promise<Record<string, unknown>> {
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [attempt["test_id"]]);
  const grants = await query("SELECT question_id FROM answers WHERE attempt_id = ? AND edit_granted = 1", [attempt["id"]]);
  const status = str(attempt["status"]);
  return {
    status,
    testStatus: test?.["status"],
    forceSubmit:
      (test && ["COMPLETED", "PAUSED"].includes(str(test["status"]))) ||
      FINAL_STATES.includes(status) ||
      deadlineExpired(attempt),
    autoSubmitted: autoSubmitted,
    locked: status === "LOCKED",
    lockReason: attempt["lock_reason"],
    editGrants: grants.map((g) => g["question_id"]),
    deadline: attempt["deadline"],
    serverTime: utcNow(),
  };
}

async function storeDirtyAnswers(attempt: Row, incoming: Record<string, unknown>): Promise<void> {
  if (!incoming || typeof incoming !== "object") return;
  const ids = (loads(str(attempt["question_ids"]), []) as unknown[]) as string[];
  const have = new Set(ids);
  const existing = await query("SELECT question_id, locked, edit_granted FROM answers WHERE attempt_id = ?", [attempt["id"]]);
  const existingMap = new Map(existing.map((r) => [str(r["question_id"]), r]));
  const inserts: [string, string][] = [];
  const updates: [string, string][] = [];
  for (const qid of Object.keys(incoming)) {
    const value = incoming[qid];
    if (value === null || value === undefined || typeof value !== "string") continue;
    if (!have.has(qid)) continue;
    const row = existingMap.get(qid);
    if (row === undefined) {
      inserts.push([qid, value.slice(0, 10000)]);
    } else if (Number(row["locked"]) === 0 && Number(row["edit_granted"]) === 0) {
      updates.push([qid, value.slice(0, 10000)]);
    }
  }
  if (inserts.length > 0) {
    const now = utcNow();
    const params: unknown[] = [];
    for (const [qid, val] of inserts) params.push(attempt["id"], qid, val, now);
    await execute(
      "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at) VALUES " +
        new Array(inserts.length).fill("(?, ?, ?, 0, 0, ?)").join(", "),
      params
    );
  }
  for (const [qid, val] of updates) {
    await execute(
      "UPDATE answers SET value = ?, updated_at = ? WHERE attempt_id = ? AND question_id = ?",
      [val, utcNow(), attempt["id"], qid]
    );
  }
}

async function heartbeat(ctx: RouteCtx): Promise<HttpResponse> {
  const attemptId = ctx.params[0];
  let attempt = await ownAttemptOr403(attemptId, ctx.user.id);
  const status = str(attempt["status"]);

  if (FINAL_STATES.includes(status)) return ok(await heartbeatPayload(attempt));

  await storeDirtyAnswers(attempt, (ctx.body["answers"] as Record<string, unknown>) ?? {});

  if (deadlineExpired(attempt)) {
    await finalizeAttempt(attempt, await storedAnswers(attempt), "TIME_EXPIRED");
    attempt = (await queryOne("SELECT * FROM attempts WHERE id = ?", [attemptId])) as Row;
    return ok(await heartbeatPayload(attempt, true));
  }

  const questionIds = (loads(str(attempt["question_ids"]), []) as unknown[]) as string[];
  let current = attempt["current_question"];
  const incoming = ctx.body["currentQuestion"];
  if (typeof incoming === "number" && !Number.isNaN(incoming)) {
    current = Math.max(0, Math.min(Math.floor(incoming), questionIds.length - 1));
  }
  await execute("UPDATE attempts SET current_question = ?, last_activity = ? WHERE id = ?", [current, utcNow(), attemptId]);
  attempt = (await queryOne("SELECT * FROM attempts WHERE id = ?", [attemptId])) as Row;
  return ok(await heartbeatPayload(attempt));
}

async function submit(ctx: RouteCtx): Promise<HttpResponse> {
  const attemptId = ctx.params[0];
  const attempt = await ownAttemptOr403(attemptId, ctx.user.id);
  if (FINAL_STATES.includes(str(attempt["status"]))) {
    throw new ApiError(409, "This attempt has already been submitted.");
  }

  const answersValue = ctx.body["answers"];
  const answers = answersValue && typeof answersValue === "object" ? (answersValue as Record<string, unknown>) : {};

  const claimed = await execute(
    "UPDATE attempts SET status = 'SUBMITTED', last_activity = ? WHERE id = ? AND status IN ('IN_PROGRESS','LOCKED')",
    [utcNow(), attemptId]
  );
  if (claimed === 0) throw new ApiError(409, "This attempt has already been submitted.");

  const fresh = (await queryOne("SELECT * FROM attempts WHERE id = ?", [attemptId])) as Row;
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [fresh["test_id"]]);

  const expired = deadlineExpired(fresh);
  let reason: string;
  if (test && ["COMPLETED", "PAUSED"].includes(str(test["status"]))) reason = "FORCE_SUBMITTED";
  else if (expired || ctx.body["reason"] === "TIME_EXPIRED") reason = "TIME_EXPIRED";
  else reason = "NORMAL";

  const result = await finalizeAttempt(fresh, answers, reason);
  return ok({
    submitted: true,
    reason,
    resultPublished: result["published"],
    summary: result["published"]
      ? { score: result["score"], maxScore: result["maxScore"], percentage: result["percentage"] }
      : null,
  });
}

async function editRequest(ctx: RouteCtx): Promise<HttpResponse> {
  const attemptId = ctx.params[0];
  const attempt = await ownAttemptOr403(attemptId, ctx.user.id);
  const status = str(attempt["status"]);
  if (FINAL_STATES.includes(status)) throw new ApiError(409, "This attempt is no longer editable.");
  if (status !== "IN_PROGRESS") throw new ApiError(409, "Your attempt is locked by staff.");
  if (deadlineExpired(attempt)) throw new ApiError(409, "Your time has expired.");

  const questionId = str(ctx.body["questionId"] ?? "");
  const answerValue = typeof ctx.body["value"] === "string" ? ctx.body["value"] : "";

  // Save the answer to DB if not already there (answers are kept in browser
  // memory during the exam and only persisted to DB on edit request or submit).
  let record = await queryOne("SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?", [attemptId, questionId]);
  if (record === undefined && answerValue) {
    await execute(
      "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at) VALUES (?, ?, ?, 1, 0, ?)",
      [attemptId, questionId, answerValue.slice(0, 10000), utcNow()]
    );
    record = await queryOne("SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?", [attemptId, questionId]);
  }
  if (record === undefined) throw new ApiError(400, "No answer to request modification for.");

  const pending = await queryOne(
    "SELECT 1 FROM edit_requests WHERE attempt_id = ? AND question_id = ? AND status = 'PENDING'",
    [attemptId, questionId]
  );
  if (pending) throw new ApiError(409, "A request for this question is already pending.");

  const requestId = `ER${uuidHex(8)}`;
  await execute(
    "INSERT INTO edit_requests (id, attempt_id, student_id, test_id, question_id, current_answer, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)",
    [
      requestId,
      attemptId,
      ctx.user.id,
      attempt["test_id"],
      questionId,
      record["value"],
      String(ctx.body["reason"] ?? "").slice(0, 500),
      utcNow(),
    ]
  );
  await securityEvent("MODIFICATION_REQUEST", ctx.user.id, "STUDENT", `Requested edit for ${questionId}`, str(attempt["test_id"]), attemptId);
  return ok({ request: { id: requestId, status: "PENDING" } });
}

async function verifyPin(ctx: RouteCtx): Promise<HttpResponse> {
  const attemptId = ctx.params[0];
  const pin = String(ctx.body["pin"] ?? "").trim();
  if (!pin) throw new ApiError(400, "Please enter staff PIN");
  const attempt = await queryOne("SELECT * FROM attempts WHERE id = ? AND student_id = ?", [attemptId, ctx.user.id]);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  // Verify PIN against any active staff/super_admin/developer password (secure, not hardcoded)
  const staffRows = await query("SELECT password_hash FROM users WHERE role IN ('STAFF','SUPER_ADMIN','DEVELOPER') AND active = 1");
  let valid = false;
  for (const row of staffRows) {
    if (verifyPassword(pin, str(row["password_hash"]))) { valid = true; break; }
  }
  if (!valid) {
    await securityEvent("STAFF_PIN_FAILED", ctx.user.id, ctx.user.role, `Invalid PIN for attempt ${attemptId}`, str(attempt["test_id"]), attemptId);
    throw new ApiError(403, "Invalid PIN. Access Denied.");
  }
  await securityEvent("STAFF_PIN_SUCCESS", ctx.user.id, ctx.user.role, `Staff unlocked attempt ${attemptId}`, str(attempt["test_id"]), attemptId);
  return ok({ ok: true });
}

async function studentResults(ctx: RouteCtx): Promise<HttpResponse> {
  const rows = await query(
    "SELECT r.*, t.name AS test_name FROM results r JOIN tests t ON t.id = r.test_id WHERE r.student_id = ? AND r.published = 1 ORDER BY r.submitted_at DESC",
    [ctx.user.id]
  );
  return ok({
    results: rows.map((r) => ({
      id: r["id"],
      testName: r["test_name"],
      totalQuestions: r["total_questions"],
      attempted: r["attempted"],
      correct: r["correct"],
      wrong: r["wrong"],
      unanswered: r["unanswered"],
      score: r["score"],
      maxScore: r["max_score"],
      percentage: r["percentage"],
      timeUsedSeconds: r["time_used_seconds"],
      submittedAt: r["submitted_at"],
    })),
  });
}

const STUDENT = ["STUDENT"];

export const studentRoutes: RouteDef[] = [
  { method: "GET", pattern: /^\/api\/student\/dashboard$/, roles: STUDENT, handler: dashboard },
  { method: "GET", pattern: /^\/api\/student\/tests$/, roles: STUDENT, handler: listTests },
  { method: "GET", pattern: /^\/api\/student\/tests\/([^/]+)$/, roles: STUDENT, handler: getTest },
  { method: "POST", pattern: /^\/api\/student\/tests\/([^/]+)\/start$/, roles: STUDENT, handler: startTest },
  { method: "GET", pattern: /^\/api\/student\/attempts\/([^/]+)$/, roles: STUDENT, handler: getAttempt },
  { method: "POST", pattern: /^\/api\/student\/attempts\/([^/]+)\/lock$/, roles: STUDENT, handler: lockAnswer },
  { method: "POST", pattern: /^\/api\/student\/attempts\/([^/]+)\/heartbeat$/, roles: STUDENT, handler: heartbeat },
  { method: "POST", pattern: /^\/api\/student\/attempts\/([^/]+)\/submit$/, roles: STUDENT, handler: submit },
  { method: "POST", pattern: /^\/api\/student\/attempts\/([^/]+)\/edit-request$/, roles: STUDENT, handler: editRequest },
  { method: "POST", pattern: /^\/api\/student\/attempts\/([^/]+)\/verify-pin$/, roles: STUDENT, handler: verifyPin },
  { method: "GET", pattern: /^\/api\/student\/results$/, roles: STUDENT, handler: studentResults },
];