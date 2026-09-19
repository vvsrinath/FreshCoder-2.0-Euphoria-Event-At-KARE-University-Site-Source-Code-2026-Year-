/** Staff routes (mirrors src/backend/routes/staff_routes.py). */
import crypto from "node:crypto";
import { ApiError, HttpResponse, ok, csvResponse } from "../http";
import { execute, query, queryOne, str, num, bool, audit, securityEvent, type Row } from "../db";
import { testSummary, questionLevelAnalytics, buildResultsCsv } from "../reporting";
import { riskByStudent, evaluateGenericFlags } from "../proctor";
import { auditLogsCsv, securityEventsCsv } from "../export";
import { RouteCtx, RouteDef } from "../router";
import { loads, parseUtc, safeInt, utcNow } from "../utils";
import { finalizeAttempt } from "./student";

const STAFF = ["STAFF", "SUPER_ADMIN"];

const DISTRIBUTION_PRESETS: Record<string, Record<string, number>> = {
  QUIZ: { MCQ: 8, TRUE_FALSE: 4, FILL_BLANK: 4 },
  MCQ: { MCQ: 20 },
  FILL_BLANK: { FILL_BLANK: 20 },
  OUTPUT: { OUTPUT: 15 },
  CODE_COMPLETION: { CODE_COMPLETION: 15 },
  DEBUGGING: { DEBUGGING: 15 },
  CODING: { CODING: 5 },
  MIXED: { MCQ: 10, TRUE_FALSE: 5, FILL_BLANK: 5, OUTPUT: 5, CODE_COMPLETION: 5, DEBUGGING: 5 },
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SCHEDULED", "ARCHIVED"],
  SCHEDULED: ["ACTIVE", "DRAFT", "ARCHIVED", "SCHEDULED"],
  ACTIVE: ["PAUSED", "COMPLETED"],
  PAUSED: ["ACTIVE", "COMPLETED", "PAUSED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

const QUESTION_TYPES = new Set([
  "MCQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "OUTPUT",
  "CODE_COMPLETION",
  "DEBUGGING",
  "CODING",
]);
const TEST_TYPES = new Set(["QUIZ", "MCQ", "FILL_BLANK", "OUTPUT", "CODE_COMPLETION", "DEBUGGING", "CODING", "MIXED"]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);
const STATUSES = new Set(["ACTIVE", "DRAFT", "ARCHIVED"]);
const SELECTION_MODES = new Set(["RANDOM", "MANUAL", "DISTRIBUTION"]);

function testToJson(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    eventId: row["event_id"],
    name: row["name"],
    description: row["description"],
    type: row["type"],
    questionCount: row["question_count"],
    durationMinutes: row["duration_minutes"],
    selectionMode: row["selection_mode"],
    distribution: loads(str(row["distribution"]), {}),
    manualQuestionIds: loads(str(row["manual_question_ids"]), []),
    scheduledStart: row["scheduled_start"],
    status: row["status"],
    resultsPublished: bool(row["results_published"]),
    startedAt: row["started_at"],
    stoppedAt: row["stopped_at"],
    createdBy: row["created_by"],
    createdAt: row["created_at"],
  };
}

function questionToJson(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    version: row["version"],
    title: row["title"],
    type: row["type"],
    topic: row["topic"],
    difficulty: row["difficulty"],
    marks: row["marks"],
    status: row["status"],
    prompt: row["prompt"],
    code: row["code"],
    options: loads(str(row["options"]), null),
    answer: row["answer"],
    alternatives: loads(str(row["alternatives"]), []),
    explanation: row["explanation"],
    inputFormat: row["input_format"],
    outputFormat: row["output_format"],
    constraints: row["constraints"],
    sampleInput: row["sample_input"],
    sampleOutput: row["sample_output"],
    testCases: loads(str(row["test_cases"]), []),
    createdBy: row["created_by"],
    createdAt: row["created_at"],
  };
}

function timingChangeToJson(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    testId: row["test_id"],
    oldDuration: row["old_duration"],
    newDuration: row["new_duration"],
    staffId: row["staff_id"],
    reason: row["reason"],
    createdAt: row["created_at"],
  };
}

function versionToJson(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    questionId: row["question_id"],
    version: row["version"],
    snapshot: loads(str(row["snapshot"]), null),
    changedBy: row["changed_by"],
    reason: row["reason"],
    createdAt: row["created_at"],
  };
}

function distributionTotal(distribution: Record<string, unknown>): number {
  let total = 0;
  for (const v of Object.values(distribution)) {
    const n = Number(v);
    if (Number.isNaN(n)) throw new Error("The question distribution must contain whole numbers.");
    if (n < 0) throw new Error("The question distribution cannot contain negative counts.");
    total += n;
  }
  return total;
}

// ---------------------------------------------------------------- dashboard
async function testPresets(_ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ distributionPresets: DISTRIBUTION_PRESETS });
}

async function dashboard(_ctx: RouteCtx): Promise<HttpResponse> {
  const count = async (sql: string): Promise<number> => num((await queryOne(sql))?.["n"]);
  const activity = await query(
    "SELECT id, actor, role, action, target, metadata, created_at AS createdAt FROM audit_logs ORDER BY id DESC LIMIT 8"
  );
  const security = await query(
    "SELECT id, type, actor, role, detail, created_at AS createdAt FROM security_events ORDER BY id DESC LIMIT 6"
  );
  return ok({
    stats: {
      totalStudents: await count("SELECT COUNT(*) n FROM users WHERE role = 'STUDENT'"),
      activeStudents: await count("SELECT COUNT(*) n FROM users WHERE role='STUDENT' AND active=1"),
      inProgress: await count("SELECT COUNT(*) n FROM attempts WHERE status='IN_PROGRESS'"),
      submitted: await count(
        "SELECT COUNT(*) n FROM attempts WHERE status IN ('SUBMITTED','FORCE_SUBMITTED','TIME_EXPIRED')"
      ),
      locked: await count("SELECT COUNT(*) n FROM attempts WHERE status='LOCKED'"),
      disconnected: await count("SELECT COUNT(*) n FROM attempts WHERE status='DISCONNECTED'"),
      editRequests: await count("SELECT COUNT(*) n FROM edit_requests WHERE status='PENDING'"),
      totalTests: await count("SELECT COUNT(*) n FROM tests"),
      activeTests: await count("SELECT COUNT(*) n FROM tests WHERE status='ACTIVE'"),
    },
    activity,
    securityEvents: security,
    serverTime: utcNow(),
  });
}

// ---------------------------------------------------------------- tests
async function listTests(_ctx: RouteCtx): Promise<HttpResponse> {
  const rows = await query("SELECT * FROM tests ORDER BY created_at DESC");
  return ok({ tests: rows.map(testToJson) });
}

async function createTest(ctx: RouteCtx): Promise<HttpResponse> {
  const body = ctx.body;
  const name = str(body["name"]).trim();
  if (!name) throw new ApiError(400, "Test name is required.");
  if (name.length > 200) throw new ApiError(400, "Test name is too long.");
  let questionCount: number;
  let duration: number;
  let testType: string;
  let selectionMode: string;
  let distribution: Record<string, unknown>;
  try {
    questionCount = safeInt(body["questionCount"], "Question count", undefined, 1);
    duration = safeInt(body["durationMinutes"], "Duration", 60, 1, 600);
    testType = str(body["type"] || "MIXED");
    selectionMode = str(body["selectionMode"] || "RANDOM");
    if (!TEST_TYPES.has(testType)) throw new Error("Unknown test type.");
    if (!SELECTION_MODES.has(selectionMode)) throw new Error("Unknown selection mode.");
    distribution = (body["distribution"] as Record<string, unknown>) || {};
    if (selectionMode === "DISTRIBUTION" && distributionTotal(distribution) !== questionCount) {
      throw new Error("The question distribution must add up to the total question count.");
    }
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : String(error));
  }

  let eventId = body["eventId"] ? str(body["eventId"]) : "";
  if (!eventId) {
    const event = await queryOne("SELECT id FROM events ORDER BY start_date LIMIT 1");
    eventId = event ? str(event["id"]) : "";
  }
  if (!eventId || !(await queryOne("SELECT 1 FROM events WHERE id = ?", [eventId]))) {
    throw new ApiError(400, "No valid event is configured. Create one first.");
  }

  const testId = `T${crypto16(8)}`;
  const scheduledStart = body["scheduledStart"] === undefined ? null : str(body["scheduledStart"]);
  await execute(
    "INSERT INTO tests (id, event_id, name, description, type, question_count, duration_minutes, selection_mode, distribution, manual_question_ids, scheduled_start, status, results_published, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)",
    [
      testId,
      eventId,
      name,
      str(body["description"] ?? "").slice(0, 2000),
      testType,
      questionCount,
      duration,
      selectionMode,
      JSON.stringify(distribution),
      JSON.stringify(Array.isArray(body["manualQuestionIds"]) ? body["manualQuestionIds"] : []),
      scheduledStart,
      scheduledStart ? "SCHEDULED" : "DRAFT",
      ctx.user.id,
      utcNow(),
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Created test", name, `${questionCount} questions · ${duration} min`);
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [testId]);
  return ok({ test: testToJson(row as Row) });
}

async function getTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  return ok({ test: testToJson(row) });
}

async function updateTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  const body = ctx.body;
  let questionCount: number;
  let newDuration: number;
  let selectionMode: string;
  let distribution: Record<string, unknown>;
  try {
    questionCount = safeInt(
      body["questionCount"] !== undefined && body["questionCount"] !== null ? body["questionCount"] : row["question_count"],
      "Question count",
      num(row["question_count"]),
      1
    );
    newDuration = safeInt(
      body["durationMinutes"] !== undefined && body["durationMinutes"] !== null
        ? body["durationMinutes"]
        : row["duration_minutes"],
      "Duration",
      num(row["duration_minutes"]),
      1,
      600
    );
    selectionMode = str(body["selectionMode"] || str(row["selection_mode"]));
    distribution =
      body["distribution"] !== undefined && body["distribution"] !== null
        ? (body["distribution"] as Record<string, unknown>)
        : (loads(str(row["distribution"]), {}) as Record<string, unknown>);
    if (selectionMode === "DISTRIBUTION" && distributionTotal(distribution) !== questionCount) {
      throw new Error("The question distribution must add up to the total question count.");
    }
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : String(error));
  }
  if (str(row["status"]) === "ACTIVE" && questionCount !== num(row["question_count"])) {
    throw new ApiError(409, "Question count cannot change while the test is live.");
  }

  if (newDuration !== num(row["duration_minutes"])) {
    await execute(
      "INSERT INTO timing_changes (test_id, old_duration, new_duration, staff_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [ctx.params[0], row["duration_minutes"], newDuration, ctx.user.id, str(body["timingReason"] || "Not specified").slice(0, 500), utcNow()]
    );
    await audit(ctx.user.id, ctx.user.role, "Changed duration", str(row["name"]), `${row["duration_minutes"]} → ${newDuration} minutes`);
    const live = await query(
      "SELECT id, started_at FROM attempts WHERE test_id = ? AND status IN ('IN_PROGRESS','LOCKED')",
      [ctx.params[0]]
    );
    for (const attempt of live) {
      const started = parseUtc(str(attempt["started_at"])) ?? new Date();
      const newDeadline = new Date(started.getTime() + newDuration * 60_000).toISOString().replace("Z", "+00:00");
      await execute("UPDATE attempts SET deadline = ? WHERE id = ?", [newDeadline, attempt["id"]]);
    }
  }

  await execute(
    "UPDATE tests SET name = ?, description = ?, type = ?, question_count = ?, duration_minutes = ?, selection_mode = ?, distribution = ?, manual_question_ids = ?, scheduled_start = ? WHERE id = ?",
    [
      str(body["name"] ?? row["name"]).slice(0, 200),
      body["description"] !== undefined ? body["description"] : row["description"],
      str(body["type"] ?? row["type"]),
      questionCount,
      newDuration,
      selectionMode,
      JSON.stringify(distribution),
      JSON.stringify(
        body["manualQuestionIds"] !== undefined
          ? body["manualQuestionIds"]
          : (loads(str(row["manual_question_ids"]), []) as unknown[])
      ),
      body["scheduledStart"] !== undefined ? body["scheduledStart"] : row["scheduled_start"],
      ctx.params[0],
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Updated test", str(body["name"] ?? row["name"]));
  const fresh = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  return ok({ test: testToJson(fresh as Row) });
}

async function duplicateTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  const newId = `T${crypto16(8)}`;
  await execute(
    "INSERT INTO tests (id, event_id, name, description, type, question_count, duration_minutes, selection_mode, distribution, manual_question_ids, scheduled_start, status, results_published, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,'DRAFT',0,?,?)",
    [
      newId,
      row["event_id"],
      `${row["name"]} (Copy)`,
      row["description"],
      row["type"],
      row["question_count"],
      row["duration_minutes"],
      row["selection_mode"],
      row["distribution"],
      row["manual_question_ids"],
      ctx.user.id,
      utcNow(),
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Duplicated test", `${row["name"]} (Copy)`, `from ${row["name"]}`);
  const fresh = await queryOne("SELECT * FROM tests WHERE id = ?", [newId]);
  return ok({ test: testToJson(fresh as Row) });
}

async function testTimingChanges(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  const changes = await query("SELECT * FROM timing_changes WHERE test_id = ? ORDER BY id DESC", [ctx.params[0]]);
  return ok({ changes: changes.map(timingChangeToJson) });
}

function transition(row: Row, target: string): void {
  if (!ALLOWED_TRANSITIONS[str(row["status"])].includes(target)) {
    throw new ApiError(409, `A ${str(row["status"]).toLowerCase()} test cannot move to ${target.toLowerCase()}.`);
  }
}

async function scheduleTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  if (str(row["selection_mode"]) === "DISTRIBUTION" && distributionTotal(loads(str(row["distribution"]), {}) as Record<string, unknown>) !== num(row["question_count"])) {
    throw new ApiError(400, "Fix the question distribution before scheduling this test.");
  }
  transition(row, "SCHEDULED");
  await execute("UPDATE tests SET scheduled_start = ? WHERE id = ?", [
    ctx.body["scheduledStart"] !== undefined ? ctx.body["scheduledStart"] : row["scheduled_start"],
    ctx.params[0],
  ]);
  await audit(ctx.user.id, ctx.user.role, "Scheduled test", str(row["name"]));
  const fresh = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  return ok({ test: testToJson(fresh as Row) });
}

async function startTest(ctx: RouteCtx): Promise<HttpResponse> {
  let row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  if (str(row["status"]) === "DRAFT") {
    transition(row, "SCHEDULED");
    row = (await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]])) as Row;
  }
  transition(row, "ACTIVE");
  await execute("UPDATE tests SET started_at = ?, status = 'ACTIVE' WHERE id = ?", [utcNow(), ctx.params[0]]);
  await audit(ctx.user.id, ctx.user.role, "Started test", str(row["name"]));
  await securityEvent("TEST_STARTED", ctx.user.id, ctx.user.role, `${row["name"]} opened`, ctx.params[0]);
  const fresh = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  return ok({ test: testToJson(fresh as Row) });
}

async function stopTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  transition(row, "PAUSED");
  await audit(ctx.user.id, ctx.user.role, "Paused test", str(row["name"]));
  const fresh = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  return ok({ test: testToJson(fresh as Row) });
}

async function forceStopTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  if (!["ACTIVE", "PAUSED"].includes(str(row["status"]))) throw new ApiError(409, "Only a live test can be force stopped.");

  await execute("UPDATE tests SET status = 'COMPLETED', stopped_at = ? WHERE id = ?", [utcNow(), ctx.params[0]]);
  const active = await query("SELECT * FROM attempts WHERE test_id = ? AND status IN ('IN_PROGRESS','LOCKED')", [ctx.params[0]]);
  for (const attempt of active) {
    const stored: Record<string, unknown> = {};
    for (const r of await query("SELECT * FROM answers WHERE attempt_id = ?", [attempt["id"]])) {
      stored[str(r["question_id"])] = str(r["value"]);
    }
    await finalizeAttempt(attempt, stored, "FORCE_SUBMITTED");
  }
  await audit(ctx.user.id, ctx.user.role, "Force stopped test", str(row["name"]), `${active.length} attempts finalised`);
  await securityEvent("TEST_FORCE_STOPPED", ctx.user.id, ctx.user.role, str(row["name"]), ctx.params[0]);
  return ok({ finalised: active.length });
}

async function archiveTest(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  if (!["DRAFT", "SCHEDULED"].includes(str(row["status"]))) {
    throw new ApiError(409, "Only a draft or scheduled test can be removed. Force-stop live tests instead.");
  }
  await execute("UPDATE tests SET status = 'ARCHIVED' WHERE id = ?", [ctx.params[0]]);
  await audit(ctx.user.id, ctx.user.role, "Archived test", str(row["name"]));
  return ok({ ok: true });
}

// ---------------------------------------------------------------- questions
async function listQuestions(ctx: RouteCtx): Promise<HttpResponse> {
  let sql = "SELECT * FROM questions WHERE 1 = 1";
  const params: unknown[] = [];
  for (const field of ["type", "topic", "difficulty", "status"]) {
    const value = ctx.query[field];
    if (value) {
      sql += ` AND ${field} = ?`;
      params.push(value);
    }
  }
  const search = ctx.query["search"];
  if (search) {
    sql += " AND (LOWER(title) LIKE ? OR LOWER(id) LIKE ?)";
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }
  const rows = await query(sql + " ORDER BY id", params);
  const topics = (await query("SELECT DISTINCT topic FROM questions ORDER BY topic")).map((r) => r["topic"]);
  return ok({ questions: rows.map(questionToJson), topics, total: rows.length });
}

async function createQuestion(ctx: RouteCtx): Promise<HttpResponse> {
  const body = ctx.body;
  if (!str(body["title"]).trim()) throw new ApiError(400, "Question title is required.");
  if (!str(body["prompt"]).trim()) throw new ApiError(400, "Question text is required.");
  const qtype = str(body["type"] || "MCQ");
  if (!QUESTION_TYPES.has(qtype)) throw new ApiError(400, "Unknown question type.");
  const difficulty = str(body["difficulty"] || "EASY");
  if (!DIFFICULTIES.has(difficulty)) throw new ApiError(400, "Unknown difficulty.");
  const status = str(body["status"] || "ACTIVE");
  if (!STATUSES.has(status)) throw new ApiError(400, "Unknown status.");
  let marks: number;
  try {
    marks = safeInt(body["marks"], "Marks", 1, 1, 100);
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : String(error));
  }

  const questionId = `Q${crypto16(6)}`;
  await execute(
    "INSERT INTO questions (id, version, title, type, topic, difficulty, marks, status, prompt, code, options, answer, alternatives, explanation, input_format, output_format, constraints, sample_input, sample_output, test_cases, created_by, created_at) VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      questionId,
      str(body["title"]).slice(0, 500),
      qtype,
      str(body["topic"] || "General").slice(0, 100),
      difficulty,
      marks,
      status,
      body["prompt"],
      body["code"] === undefined ? null : body["code"],
      body["options"] ? JSON.stringify(body["options"]) : null,
      str(body["answer"] ?? ""),
      JSON.stringify(Array.isArray(body["alternatives"]) ? body["alternatives"] : []),
      body["explanation"] === undefined ? null : body["explanation"],
      body["inputFormat"] === undefined ? null : body["inputFormat"],
      body["outputFormat"] === undefined ? null : body["outputFormat"],
      body["constraints"] === undefined ? null : body["constraints"],
      body["sampleInput"] === undefined ? null : body["sampleInput"],
      body["sampleOutput"] === undefined ? null : body["sampleOutput"],
      JSON.stringify(Array.isArray(body["testCases"]) ? body["testCases"] : []),
      ctx.user.id,
      utcNow(),
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Created question", questionId, str(body["title"]));
  const fresh = await queryOne("SELECT * FROM questions WHERE id = ?", [questionId]);
  return ok({ question: questionToJson(fresh as Row) });
}

async function singleQuestion(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM questions WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Question not found.");
  const versions = await query("SELECT * FROM question_versions WHERE question_id = ? ORDER BY id DESC", [ctx.params[0]]);
  return ok({ question: questionToJson(row), versions: versions.map(versionToJson) });
}

async function updateQuestion(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM questions WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Question not found.");
  const body = ctx.body;
  let marks: number;
  try {
    marks = safeInt(
      body["marks"] !== undefined && body["marks"] !== null ? body["marks"] : row["marks"],
      "Marks",
      num(row["marks"]),
      1,
      100
    );
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : String(error));
  }
  const qtype = str(body["type"] ?? row["type"]);
  if (!QUESTION_TYPES.has(qtype)) throw new ApiError(400, "Unknown question type.");
  if (body["status"] !== undefined && body["status"] !== null && !STATUSES.has(str(body["status"]))) {
    throw new ApiError(400, "Unknown status.");
  }

  const inUse = await queryOne("SELECT 1 FROM attempts WHERE question_ids LIKE ?", [`%"${ctx.params[0]}"%`]);
  let version = num(row["version"]);
  if (inUse) {
    await execute(
      "INSERT INTO question_versions (question_id, version, snapshot, changed_by, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        ctx.params[0],
        version,
        JSON.stringify(questionToJson(row)),
        ctx.user.id,
        str(body["reason"] || "Correction during live test").slice(0, 500),
        utcNow(),
      ]
    );
    version += 1;
  }

  await execute(
    "UPDATE questions SET version = ?, title = ?, type = ?, topic = ?, difficulty = ?, marks = ?, status = ?, prompt = ?, code = ?, options = ?, answer = ?, alternatives = ?, explanation = ? WHERE id = ?",
    [
      version,
      str(body["title"] ?? row["title"]).slice(0, 500),
      qtype,
      str(body["topic"] ?? row["topic"]).slice(0, 100),
      str(body["difficulty"] ?? row["difficulty"]),
      marks,
      body["status"] !== undefined ? body["status"] : row["status"],
      body["prompt"] !== undefined ? body["prompt"] : row["prompt"],
      body["code"] !== undefined ? body["code"] : row["code"],
      body["options"] !== undefined && body["options"] !== null ? JSON.stringify(body["options"]) : row["options"],
      str(body["answer"] ?? row["answer"]),
      body["alternatives"] !== undefined && body["alternatives"] !== null
        ? JSON.stringify(body["alternatives"])
        : row["alternatives"],
      body["explanation"] !== undefined ? body["explanation"] : row["explanation"],
      ctx.params[0],
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Updated question", ctx.params[0], `v${version}`);
  const fresh = await queryOne("SELECT * FROM questions WHERE id = ?", [ctx.params[0]]);
  return ok({ question: questionToJson(fresh as Row) });
}

async function archiveQuestion(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM questions WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Question not found.");
  await execute("UPDATE questions SET status = 'ARCHIVED' WHERE id = ?", [ctx.params[0]]);
  await audit(ctx.user.id, ctx.user.role, "Archived question", ctx.params[0], str(row["title"]));
  return ok({ ok: true });
}

async function duplicateQuestion(ctx: RouteCtx): Promise<HttpResponse> {
  const source = await queryOne("SELECT * FROM questions WHERE id = ?", [ctx.params[0]]);
  if (source === undefined) throw new ApiError(404, "Question not found.");
  const copyId = `Q${crypto16(6)}`;
  await execute(
    "INSERT INTO questions (id, version, title, type, topic, difficulty, marks, status, prompt, code, options, answer, alternatives, explanation, input_format, output_format, constraints, sample_input, sample_output, test_cases, created_by, created_at) VALUES (?,1,?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      copyId,
      `${source["title"]} (Copy)`,
      source["type"],
      source["topic"],
      source["difficulty"],
      source["marks"],
      source["prompt"],
      source["code"],
      source["options"],
      source["answer"],
      source["alternatives"],
      source["explanation"],
      source["input_format"],
      source["output_format"],
      source["constraints"],
      source["sample_input"],
      source["sample_output"],
      source["test_cases"],
      ctx.user.id,
      utcNow(),
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Duplicated question", copyId, `from ${ctx.params[0]}`);
  const fresh = await queryOne("SELECT * FROM questions WHERE id = ?", [copyId]);
  return ok({ question: questionToJson(fresh as Row) });
}

// ---------------------------------------------------------------- monitoring
async function live(_ctx: RouteCtx): Promise<HttpResponse> {
  const attempts = await query("SELECT * FROM attempts");
  const rows: Record<string, unknown>[] = [];
  for (const attempt of attempts) {
    const answers = await query("SELECT * FROM answers WHERE attempt_id = ?", [attempt["id"]]);
    const student = await queryOne("SELECT name FROM users WHERE id = ?", [attempt["student_id"]]);
    const test = await queryOne("SELECT name FROM tests WHERE id = ?", [attempt["test_id"]]);
    const events = await queryOne("SELECT COUNT(*) n FROM security_events WHERE attempt_id = ?", [attempt["id"]]);
    rows.push({
      attemptId: attempt["id"],
      studentId: attempt["student_id"],
      name: student ? student["name"] : attempt["student_id"],
      testId: attempt["test_id"],
      testName: test ? test["name"] : attempt["test_id"],
      status: attempt["status"],
      currentQuestion: num(attempt["current_question"]) + 1,
      totalQuestions: (loads(str(attempt["question_ids"]), []) as unknown[]).length,
      answered: answers.filter((a) => str(a["value"]).trim() !== "").length,
      locked: answers.filter((a) => Number(a["locked"]) === 1).length,
      lastActivity: attempt["last_activity"],
      securityEvents: num(events?.["n"]),
    });
  }
  const finalStatuses = ["SUBMITTED", "FORCE_SUBMITTED", "TIME_EXPIRED"];
  return ok({
    rows,
    stats: {
      total: num((await queryOne("SELECT COUNT(*) n FROM users WHERE role='STUDENT'"))?.["n"]),
      active: rows.filter((r) => r["status"] === "IN_PROGRESS").length,
      submitted: rows.filter((r) => finalStatuses.includes(str(r["status"]))).length,
      locked: rows.filter((r) => r["status"] === "LOCKED").length,
      disconnected: rows.filter((r) => r["status"] === "DISCONNECTED").length,
      securityEvents: num((await queryOne("SELECT COUNT(*) n FROM security_events"))?.["n"]),
    },
    serverTime: utcNow(),
  });
}

async function lockStudent(ctx: RouteCtx): Promise<HttpResponse> {
  const attempt = await queryOne("SELECT * FROM attempts WHERE student_id = ? AND status = 'IN_PROGRESS'", [ctx.params[0]]);
  if (attempt === undefined) throw new ApiError(404, "No live attempt found for this student.");
  const reason = str(ctx.body["reason"] ?? "Locked by examination staff").slice(0, 500);
  await execute("UPDATE attempts SET status='LOCKED', locked_by_staff=?, lock_reason=? WHERE id=?", [
    ctx.user.id,
    reason,
    attempt["id"],
  ]);
  await audit(ctx.user.id, ctx.user.role, "Locked student", ctx.params[0], reason);
  await securityEvent("STUDENT_LOCKED", ctx.user.id, ctx.user.role, ctx.params[0], str(attempt["test_id"]), str(attempt["id"]));
  return ok({ ok: true });
}

async function unlockStudent(ctx: RouteCtx): Promise<HttpResponse> {
  const attempt = await queryOne("SELECT * FROM attempts WHERE student_id = ? AND status = 'LOCKED'", [ctx.params[0]]);
  if (attempt === undefined) throw new ApiError(404, "This student is not locked.");
  await execute("UPDATE attempts SET status='IN_PROGRESS', locked_by_staff=NULL, lock_reason=NULL WHERE id=?", [attempt["id"]]);
  await audit(ctx.user.id, ctx.user.role, "Unlocked student", ctx.params[0]);
  await securityEvent("STUDENT_UNLOCKED", ctx.user.id, ctx.user.role, ctx.params[0], str(attempt["test_id"]), str(attempt["id"]));
  return ok({ ok: true });
}

async function forceSubmitStudent(ctx: RouteCtx): Promise<HttpResponse> {
  const attempt = await queryOne("SELECT * FROM attempts WHERE student_id = ? AND status IN ('IN_PROGRESS','LOCKED')", [
    ctx.params[0],
  ]);
  if (attempt === undefined) throw new ApiError(404, "No live attempt found for this student.");
  const stored: Record<string, unknown> = {};
  for (const r of await query("SELECT * FROM answers WHERE attempt_id = ?", [attempt["id"]])) {
    stored[str(r["question_id"])] = str(r["value"]);
  }
  const result = await finalizeAttempt(attempt, stored, "FORCE_SUBMITTED");
  await audit(ctx.user.id, ctx.user.role, "Force submitted student", ctx.params[0], `score ${result["score"]}/${result["maxScore"]}`);
  return ok({ ok: true, result });
}

// ---------------------------------------------------------------- edit requests
async function editRequests(_ctx: RouteCtx): Promise<HttpResponse> {
  const rows = await query(
    "SELECT e.*, u.name AS student_name, t.name AS test_name, q.title AS question_title FROM edit_requests e JOIN users u ON u.id = e.student_id JOIN tests t ON t.id = e.test_id JOIN questions q ON q.id = e.question_id ORDER BY e.created_at DESC"
  );
  return ok({
    requests: rows.map((r) => ({
      id: r["id"],
      attemptId: r["attempt_id"],
      studentId: r["student_id"],
      studentName: r["student_name"],
      testId: r["test_id"],
      testName: r["test_name"],
      questionId: r["question_id"],
      questionTitle: r["question_title"],
      currentAnswer: r["current_answer"],
      reason: r["reason"],
      status: r["status"],
      decidedBy: r["decided_by"],
      decidedAt: r["decided_at"],
      createdAt: r["created_at"],
    })),
  });
}

async function decideRequest(requestId: string, approve: boolean, user: { id: string; role: string }): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM edit_requests WHERE id = ?", [requestId]);
  if (row === undefined) throw new ApiError(404, "Request not found.");
  if (str(row["status"]) !== "PENDING") throw new ApiError(409, "This request has already been decided.");
  if (approve) {
    await execute("UPDATE answers SET edit_granted = 1 WHERE attempt_id = ? AND question_id = ?", [
      row["attempt_id"],
      row["question_id"],
    ]);
  }
  await execute("UPDATE edit_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?", [
    approve ? "APPROVED" : "DENIED",
    user.id,
    utcNow(),
    requestId,
  ]);
  const action = approve ? "Approved modification" : "Denied modification";
  await audit(user.id, user.role, action, str(row["student_id"]), str(row["question_id"]));
  await securityEvent(
    approve ? "MODIFICATION_APPROVED" : "MODIFICATION_DENIED",
    user.id,
    user.role,
    `${row["student_id"]} · ${row["question_id"]}`,
    str(row["test_id"]),
    str(row["attempt_id"])
  );
  return ok({ ok: true });
}

// ---------------------------------------------------------------- results & logs
async function results(ctx: RouteCtx): Promise<HttpResponse> {
  let sql =
    "SELECT r.*, u.name AS student_name, t.name AS test_name, a.status AS attempt_status FROM results r JOIN users u ON u.id = r.student_id JOIN tests t ON t.id = r.test_id JOIN attempts a ON a.id = r.attempt_id WHERE 1 = 1";
  const params: unknown[] = [];
  if (ctx.query["testId"]) {
    sql += " AND r.test_id = ?";
    params.push(ctx.query["testId"]);
  }
  if (ctx.query["status"] === "PUBLISHED") sql += " AND r.published = 1";
  if (ctx.query["status"] === "HIDDEN") sql += " AND r.published = 0";
  if (ctx.query["search"]) {
    sql += " AND (LOWER(r.student_id) LIKE ? OR LOWER(u.name) LIKE ?)";
    const term = `%${ctx.query["search"].toLowerCase()}%`;
    params.push(term, term);
  }
  const rows = await query(sql + " ORDER BY r.submitted_at DESC", params);
  return ok({
    results: rows.map((r) => ({
      id: r["id"],
      studentId: r["student_id"],
      studentName: r["student_name"],
      testId: r["test_id"],
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
      published: bool(r["published"]),
      attemptStatus: r["attempt_status"],
    })),
  });
}

async function singleResult(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne(
    "SELECT r.*, u.name AS student_name, t.name AS test_name, a.status AS attempt_status FROM results r JOIN users u ON u.id = r.student_id JOIN tests t ON t.id = r.test_id JOIN attempts a ON a.id = r.attempt_id WHERE r.id = ?",
    [ctx.params[0]]
  );
  if (row === undefined) throw new ApiError(404, "Result not found.");
  if (ctx.user.role === "STUDENT" && (str(row["student_id"]) !== ctx.user.id || !bool(row["published"]))) {
    throw new ApiError(403, "You do not have permission to view this result.");
  }
  return ok({
    result: {
      id: row["id"],
      studentId: row["student_id"],
      studentName: row["student_name"],
      testId: row["test_id"],
      testName: row["test_name"],
      totalQuestions: row["total_questions"],
      attempted: row["attempted"],
      correct: row["correct"],
      wrong: row["wrong"],
      unanswered: row["unanswered"],
      score: row["score"],
      maxScore: row["max_score"],
      percentage: row["percentage"],
      timeUsedSeconds: row["time_used_seconds"],
      submittedAt: row["submitted_at"],
      published: bool(row["published"]),
      attemptStatus: row["attempt_status"],
    },
  });
}

async function publishResults(ctx: RouteCtx): Promise<HttpResponse> {
  const body = ctx.body;
  const testId = str(body["testId"] ?? "");
  const published = body["published"] ? 1 : 0;
  const row = await queryOne("SELECT * FROM tests WHERE id = ?", [testId]);
  if (row === undefined) throw new ApiError(404, "Test not found.");
  await execute("UPDATE tests SET results_published = ? WHERE id = ?", [published, testId]);
  await execute("UPDATE results SET published = ? WHERE test_id = ?", [published, testId]);
  await audit(ctx.user.id, ctx.user.role, published ? "Published results" : "Hid results", str(row["name"]));
  return ok({ ok: true });
}

async function securityEvents(ctx: RouteCtx): Promise<HttpResponse> {
  let sql = "SELECT * FROM security_events WHERE 1 = 1";
  const params: unknown[] = [];
  if (ctx.query["type"]) {
    sql += " AND type = ?";
    params.push(ctx.query["type"]);
  }
  if (ctx.query["search"]) {
    sql += " AND (LOWER(actor) LIKE ? OR LOWER(detail) LIKE ?)";
    const term = `%${ctx.query["search"].toLowerCase()}%`;
    params.push(term, term);
  }
  const rows = await query(sql + " ORDER BY id DESC LIMIT 500", params);
  const types = (await query("SELECT DISTINCT type FROM security_events ORDER BY type")).map((r) => r["type"]);
  return ok({
    events: rows.map((r) => ({
      id: r["id"],
      type: r["type"],
      actor: r["actor"],
      role: r["role"],
      detail: r["detail"],
      createdAt: r["created_at"],
    })),
    types,
  });
}

async function auditLogs(ctx: RouteCtx): Promise<HttpResponse> {
  let sql = "SELECT * FROM audit_logs WHERE 1 = 1";
  const params: unknown[] = [];
  if (ctx.query["search"]) {
    sql += " AND (LOWER(actor) LIKE ? OR LOWER(action) LIKE ? OR LOWER(target) LIKE ?)";
    const term = `%${ctx.query["search"].toLowerCase()}%`;
    params.push(term, term, term);
  }
  const rows = await query(sql + " ORDER BY id DESC LIMIT 500", params);
  return ok({
    logs: rows.map((r) => ({
      id: r["id"],
      actor: r["actor"],
      role: r["role"],
      action: r["action"],
      target: r["target"],
      metadata: r["metadata"],
      createdAt: r["created_at"],
    })),
  });
}

// ---------------------------------------------------------------- reports
async function analyticsReport(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.query["testId"] ?? "";
  if (!testId) throw new ApiError(400, "A testId is required.");
  if (!(await queryOne("SELECT 1 FROM tests WHERE id = ?", [testId]))) throw new ApiError(404, "Test not found.");
  await audit(ctx.user.id, ctx.user.role, "Viewed analytics", testId);
  return ok({ summary: await testSummary(testId), perQuestion: await questionLevelAnalytics(testId) });
}

async function proctorReport(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.query["testId"] ?? "";
  if (!testId) throw new ApiError(400, "A testId is required.");
  if (!(await queryOne("SELECT 1 FROM tests WHERE id = ?", [testId]))) throw new ApiError(404, "Test not found.");
  return ok({ risk: await riskByStudent(testId), flags: await evaluateGenericFlags() });
}

async function resultsCsvDownload(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.query["testId"] ?? "";
  if (!testId) throw new ApiError(400, "A testId is required.");
  if (!(await queryOne("SELECT 1 FROM tests WHERE id = ?", [testId]))) throw new ApiError(404, "Test not found.");
  const test = await queryOne("SELECT name FROM tests WHERE id = ?", [testId]);
  await audit(ctx.user.id, ctx.user.role, "Exported results CSV", str(test?.["name"]));
  return csvResponse(await buildResultsCsv(testId), `results-${testId}.csv`);
}

async function auditLogsCsvDownload(ctx: RouteCtx): Promise<HttpResponse> {
  return csvResponse(await auditLogsCsv(ctx.query["search"] ?? ""), "audit-logs.csv");
}

async function securityEventsCsvDownload(ctx: RouteCtx): Promise<HttpResponse> {
  return csvResponse(await securityEventsCsv(ctx.query["testId"] ?? ""), "security-events.csv");
}

function crypto16(len: number): string {
  return Array.from(crypto.randomBytes(Math.ceil(len / 2)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(0, len);
}

export const staffRoutes: RouteDef[] = [
  { method: "GET", pattern: /^\/api\/staff\/tests\/presets$/, roles: STAFF, handler: testPresets },
  { method: "GET", pattern: /^\/api\/staff\/dashboard$/, roles: STAFF, handler: dashboard },
  { method: "GET", pattern: /^\/api\/staff\/tests$/, roles: STAFF, handler: listTests },
  { method: "POST", pattern: /^\/api\/staff\/tests$/, roles: STAFF, handler: createTest },
  { method: "GET", pattern: /^\/api\/staff\/tests\/([^/]+)\/timing-changes$/, roles: STAFF, handler: testTimingChanges },
  { method: "POST", pattern: /^\/api\/staff\/tests\/([^/]+)\/duplicate$/, roles: STAFF, handler: duplicateTest },
  { method: "POST", pattern: /^\/api\/staff\/tests\/([^/]+)\/schedule$/, roles: STAFF, handler: scheduleTest },
  { method: "POST", pattern: /^\/api\/staff\/tests\/([^/]+)\/start$/, roles: STAFF, handler: startTest },
  { method: "POST", pattern: /^\/api\/staff\/tests\/([^/]+)\/stop$/, roles: STAFF, handler: stopTest },
  { method: "POST", pattern: /^\/api\/staff\/tests\/([^/]+)\/force-stop$/, roles: STAFF, handler: forceStopTest },
  { method: "GET", pattern: /^\/api\/staff\/tests\/([^/]+)$/, roles: STAFF, handler: getTest },
  { method: "PUT", pattern: /^\/api\/staff\/tests\/([^/]+)$/, roles: STAFF, handler: updateTest },
  { method: "DELETE", pattern: /^\/api\/staff\/tests\/([^/]+)$/, roles: STAFF, handler: archiveTest },

  { method: "GET", pattern: /^\/api\/questions$/, roles: STAFF, handler: listQuestions },
  { method: "POST", pattern: /^\/api\/questions$/, roles: STAFF, handler: createQuestion },
  { method: "POST", pattern: /^\/api\/questions\/([^/]+)\/duplicate$/, roles: STAFF, handler: duplicateQuestion },
  { method: "GET", pattern: /^\/api\/questions\/([^/]+)$/, roles: STAFF, handler: singleQuestion },
  { method: "PUT", pattern: /^\/api\/questions\/([^/]+)$/, roles: STAFF, handler: updateQuestion },
  { method: "DELETE", pattern: /^\/api\/questions\/([^/]+)$/, roles: STAFF, handler: archiveQuestion },

  { method: "GET", pattern: /^\/api\/staff\/live$/, roles: STAFF, handler: live },
  { method: "POST", pattern: /^\/api\/staff\/students\/([^/]+)\/lock$/, roles: STAFF, handler: lockStudent },
  { method: "POST", pattern: /^\/api\/staff\/students\/([^/]+)\/unlock$/, roles: STAFF, handler: unlockStudent },
  { method: "POST", pattern: /^\/api\/staff\/students\/([^/]+)\/force-submit$/, roles: STAFF, handler: forceSubmitStudent },

  { method: "GET", pattern: /^\/api\/staff\/edit-requests$/, roles: STAFF, handler: editRequests },
  { method: "POST", pattern: /^\/api\/staff\/edit-requests\/([^/]+)\/approve$/, roles: STAFF, handler: (c) => decideRequest(c.params[0], true, c.user) },
  { method: "POST", pattern: /^\/api\/staff\/edit-requests\/([^/]+)\/deny$/, roles: STAFF, handler: (c) => decideRequest(c.params[0], false, c.user) },

  { method: "GET", pattern: /^\/api\/results$/, roles: STAFF, handler: results },
  { method: "POST", pattern: /^\/api\/results\/publish$/, roles: STAFF, handler: publishResults },
  { method: "GET", pattern: /^\/api\/results\/([^/]+)$/, roles: ["STAFF", "SUPER_ADMIN", "STUDENT"], handler: singleResult },

  { method: "GET", pattern: /^\/api\/staff\/security-events$/, roles: STAFF, handler: securityEvents },
  { method: "GET", pattern: /^\/api\/staff\/audit-logs$/, roles: STAFF, handler: auditLogs },

  { method: "GET", pattern: /^\/api\/staff\/reports\/analytics$/, roles: STAFF, handler: analyticsReport },
  { method: "GET", pattern: /^\/api\/staff\/reports\/proctor$/, roles: STAFF, handler: proctorReport },
  { method: "GET", pattern: /^\/api\/staff\/reports\/results\.csv$/, roles: STAFF, handler: resultsCsvDownload },
  { method: "GET", pattern: /^\/api\/staff\/audit-logs\.csv$/, roles: STAFF, handler: auditLogsCsvDownload },
  { method: "GET", pattern: /^\/api\/staff\/security-events\.csv$/, roles: STAFF, handler: securityEventsCsvDownload },
];