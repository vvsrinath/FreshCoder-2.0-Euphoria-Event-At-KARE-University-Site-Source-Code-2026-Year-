/** Admin routes (mirrors src/backend/routes/admin_routes.py). */
import crypto from "node:crypto";
import { ApiError, HttpResponse, ok } from "../http";
import { execute, query, queryOne, str, num, bool, audit, type Row } from "../db";
import { hashPassword, revokeUserSessions } from "../auth";
import { RouteCtx, RouteDef } from "../router";
import { utcNow } from "../utils";
import { passwordError } from "../policy";

const SUPER_ADMIN = ["SUPER_ADMIN"];
const MAX_IMPORT_ROWS = 5000;

function validatePassword(password: string): string {
  return passwordError(password);
}

function userToJson(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    name: row["name"],
    email: row["email"],
    role: row["role"],
    active: bool(row["active"]),
    createdAt: row["created_at"],
  };
}

async function listUsers(role: string, ctx: RouteCtx): Promise<Record<string, unknown>[]> {
  let sql = "SELECT * FROM users WHERE role = ?";
  const params: unknown[] = [role];
  const status = ctx.query["status"];
  if (status === "ACTIVE") sql += " AND active = 1";
  else if (status === "INACTIVE") sql += " AND active = 0";
  const search = ctx.query["search"];
  if (search) {
    sql += " AND (LOWER(id) LIKE ? OR LOWER(name) LIKE ?)";
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term);
  }
  return (await query(sql + " ORDER BY id", params)).map(userToJson);
}

async function createAccount(role: string, ctx: RouteCtx): Promise<Row> {
  const body = ctx.body;
  const userId = str(body["id"] ?? "").trim().toUpperCase();
  const name = str(body["name"] ?? "").trim();
  const password = str(body["password"] ?? "");
  if (!userId || !name || !password) throw new ApiError(400, "ID, name and password are required.");
  if (userId.length > 60 || name.length > 200) throw new ApiError(400, "ID or name is too long.");
  const error = validatePassword(password);
  if (error) throw new ApiError(400, error);
  const exists = await queryOne("SELECT 1 FROM users WHERE UPPER(id) = ?", [userId]);
  if (exists) throw new ApiError(409, `${userId} already exists.`);
  await execute(
    "INSERT INTO users (id, role, name, email, password_hash, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
    [userId, role, name, str(body["email"] ?? "").trim().slice(0, 200), hashPassword(password), utcNow()]
  );
  await audit(ctx.user.id, ctx.user.role, role === "STUDENT" ? "Created student" : "Created staff", userId, name);
  const row = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
  if (row === undefined) throw new ApiError(500, "Unexpected server error.");
  return row;
}

async function updateAccount(userId: string, role: string, ctx: RouteCtx): Promise<Row> {
  const row = await queryOne("SELECT * FROM users WHERE id = ? AND role = ?", [userId, role]);
  if (row === undefined) throw new ApiError(404, "Account not found.");
  const body = ctx.body;
  if (body["password"]) {
    const error = validatePassword(str(body["password"]));
    if (error) throw new ApiError(400, error);
    await execute("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(str(body["password"])), userId]);
    await revokeUserSessions(userId);
    await audit(ctx.user.id, ctx.user.role, "Reset password", userId);
  }
  if (body["active"] !== undefined) {
    const active = body["active"] ? 1 : 0;
    await execute("UPDATE users SET active = ? WHERE id = ?", [active, userId]);
    await audit(ctx.user.id, ctx.user.role, body["active"] ? "Activated account" : "Deactivated account", userId);
  }
  if (body["name"] || body["email"] !== undefined) {
    await execute("UPDATE users SET name = ?, email = ? WHERE id = ?", [
      str(body["name"] ?? row["name"]).slice(0, 200),
      str(body["email"] ?? row["email"]).slice(0, 200),
      userId,
    ]);
    await audit(ctx.user.id, ctx.user.role, "Edited account", userId);
  }
  const fresh = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
  if (fresh === undefined) throw new ApiError(500, "Unexpected server error.");
  return fresh;
}

async function overview(_ctx: RouteCtx): Promise<HttpResponse> {
  const count = async (sql: string): Promise<number> => num((await queryOne(sql))?.["n"]);
  const recentAudit = await query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8");
  const security = await query("SELECT * FROM security_events ORDER BY id DESC LIMIT 6");
  return ok({
    stats: {
      students: await count("SELECT COUNT(*) n FROM users WHERE role='STUDENT'"),
      activeStudents: await count("SELECT COUNT(*) n FROM users WHERE role='STUDENT' AND active=1"),
      staff: await count("SELECT COUNT(*) n FROM users WHERE role='STAFF'"),
      events: await count("SELECT COUNT(*) n FROM events"),
      tests: await count("SELECT COUNT(*) n FROM tests"),
      questions: await count("SELECT COUNT(*) n FROM questions WHERE status='ACTIVE'"),
      results: await count("SELECT COUNT(*) n FROM results"),
    },
    recentAudit: recentAudit.map((r) => ({
      id: r["id"],
      actor: r["actor"],
      action: r["action"],
      target: r["target"],
      metadata: r["metadata"],
      createdAt: r["created_at"],
    })),
    securityEvents: security.map((r) => ({
      id: r["id"],
      type: r["type"],
      actor: r["actor"],
      createdAt: r["created_at"],
    })),
  });
}

async function students(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ students: await listUsers("STUDENT", ctx) });
}

async function createStudent(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ student: userToJson(await createAccount("STUDENT", ctx)) });
}

async function updateStudent(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ student: userToJson(await updateAccount(ctx.params[0], "STUDENT", ctx)) });
}

async function importStudents(ctx: RouteCtx): Promise<HttpResponse> {
  const body = ctx.body;
  const rows = Array.isArray(body["rows"]) ? (body["rows"] as Record<string, unknown>[]) : [];
  if (rows.length === 0) throw new ApiError(400, "The uploaded file contains no rows.");
  if (rows.length > MAX_IMPORT_ROWS) throw new ApiError(400, `Too many rows. Import at most ${MAX_IMPORT_ROWS} at once.`);
  const errors: Record<string, unknown>[] = [];
  let success = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const studentId = str(row["student_id"] ?? "").trim().toUpperCase();
    const name = str(row["name"] ?? "").trim();
    const password = str(row["password"] ?? "").trim();
    if (!studentId || !name || !password) {
      errors.push({ row: index + 2, message: "Missing student_id, name or password" });
      continue;
    }
    const error = validatePassword(password);
    if (error) {
      errors.push({ row: index + 2, message: error });
      continue;
    }
    const exists = await queryOne("SELECT 1 FROM users WHERE UPPER(id) = ?", [studentId]);
    if (exists) {
      errors.push({ row: index + 2, message: `Duplicate ID ${studentId}` });
      continue;
    }
    await execute(
      "INSERT INTO users (id, role, name, email, password_hash, active, created_at) VALUES (?, 'STUDENT', ?, ?, ?, 1, ?)",
      [studentId, name, str(row["email"] ?? "").trim().slice(0, 200), hashPassword(password), utcNow()]
    );
    success += 1;
  }
  await audit(ctx.user.id, ctx.user.role, "Imported students", `${rows.length} rows`, `${success} imported, ${errors.length} failed`);
  return ok({ total: rows.length, success, failed: errors.length, errors });
}

async function staffAccounts(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ staff: await listAdminStaff(ctx) });
}

async function listAdminStaff(ctx: RouteCtx): Promise<Record<string, unknown>[]> {
  let sql = "SELECT * FROM users WHERE role IN ('STAFF', 'SUPER_ADMIN')";
  const params: unknown[] = [];
  const status = ctx.query["status"];
  if (status === "ACTIVE") sql += " AND active = 1";
  else if (status === "INACTIVE") sql += " AND active = 0";
  const search = ctx.query["search"];
  if (search) {
    sql += " AND (LOWER(id) LIKE ? OR LOWER(name) LIKE ?)";
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term);
  }
  return (await query(sql + " ORDER BY id", params)).map(userToJson);
}

async function createStaff(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ staff: userToJson(await createAccount("STAFF", ctx)) });
}

async function updateStaff(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ staff: userToJson(await updateAccount(ctx.params[0], "STAFF", ctx)) });
}

async function assignStaffRole(ctx: RouteCtx): Promise<HttpResponse> {
  const userId = String(ctx.params[0]).toUpperCase();
  const next = str(ctx.body["role"] ?? "").toUpperCase();
  if (!["SUPER_ADMIN", "STAFF"].includes(next)) throw new ApiError(400, "Role must be SUPER_ADMIN or STAFF.");
  const row = await queryOne("SELECT * FROM users WHERE id = ? AND role IN ('STAFF', 'SUPER_ADMIN')", [userId]);
  if (row === undefined) throw new ApiError(404, "Account not found.");
  const current = str(row["role"]);
  if (next === current) return ok({ staff: userToJson(row) });
  if (next === "SUPER_ADMIN") {
    await execute("UPDATE users SET role = 'SUPER_ADMIN' WHERE id = ?", [userId]);
    await audit(ctx.user.id, ctx.user.role, "Assigned admin role", userId, str(row["name"]));
  } else {
    if (userId === ctx.user.id) throw new ApiError(400, "You cannot remove your own admin role.");
    const activeAdmins = await queryOne(
      "SELECT COUNT(*) n FROM users WHERE role = 'SUPER_ADMIN' AND active = 1",
      []
    );
    if (num(activeAdmins?.["n"]) <= 1) throw new ApiError(400, "At least one active admin must remain.");
    await execute("UPDATE users SET role = 'STAFF' WHERE id = ?", [userId]);
    await revokeUserSessions(userId);
    await audit(ctx.user.id, ctx.user.role, "Removed admin role", userId, str(row["name"]));
  }
  const fresh = await queryOne("SELECT * FROM users WHERE id = ?", [userId]);
  if (fresh === undefined) throw new ApiError(500, "Unexpected server error.");
  return ok({ staff: userToJson(fresh) });
}

async function events(_ctx: RouteCtx): Promise<HttpResponse> {
  const rows = await query("SELECT * FROM events ORDER BY start_date");
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const testCount = await queryOne("SELECT COUNT(*) n FROM tests WHERE event_id = ?", [r["id"]]);
    out.push({
      id: r["id"],
      name: r["name"],
      description: r["description"],
      department: r["department"],
      startDate: r["start_date"],
      endDate: r["end_date"],
      venue: r["venue"],
      status: r["status"],
      registrationSite: r["registration_site"],
      registrationFee: r["registration_fee"],
      prizePool: r["prize_pool"],
      testCount: num(testCount?.["n"]),
    });
  }
  return ok({ events: out });
}

function validateEventDates(body: Record<string, unknown>): string {
  const start = str(body["startDate"] ?? "");
  const end = str(body["endDate"] ?? "");
  if (start && end) {
    const startMs = new Date(start.replace(" ", "T")).getTime();
    const endMs = new Date(end.replace(" ", "T")).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "Event dates must be valid ISO dates.";
    if (endMs < startMs) return "The event end date cannot be before its start date.";
  }
  return "";
}

async function createEvent(ctx: RouteCtx): Promise<HttpResponse> {
  const body = ctx.body;
  if (!str(body["name"] ?? "").trim()) throw new ApiError(400, "Event name is required.");
  const dateError = validateEventDates(body);
  if (dateError) throw new ApiError(400, dateError);
  const eventId = `EV${crypto16(6)}`;
  await execute(
    "INSERT INTO events (id, name, description, department, start_date, end_date, venue, status, registration_site, registration_fee, prize_pool) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [
      eventId,
      str(body["name"]).slice(0, 200),
      str(body["description"] ?? ""),
      str(body["department"] ?? ""),
      str(body["startDate"] ?? ""),
      str(body["endDate"] ?? ""),
      str(body["venue"] ?? ""),
      str(body["status"] ?? "DRAFT"),
      str(body["registrationSite"] ?? ""),
      str(body["registrationFee"] ?? ""),
      str(body["prizePool"] ?? ""),
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Created event", str(body["name"]));
  return ok({ event: { id: eventId, ...body } });
}

async function updateEvent(ctx: RouteCtx): Promise<HttpResponse> {
  const row = await queryOne("SELECT * FROM events WHERE id = ?", [ctx.params[0]]);
  if (row === undefined) throw new ApiError(404, "Event not found.");
  const body = ctx.body;
  const dateError = validateEventDates(body);
  if (dateError) throw new ApiError(400, dateError);
  await execute(
    "UPDATE events SET name=?, description=?, department=?, start_date=?, end_date=?, venue=?, status=?, registration_site=?, registration_fee=?, prize_pool=? WHERE id=?",
    [
      body["name"] !== undefined ? body["name"] : row["name"],
      body["description"] !== undefined ? body["description"] : row["description"],
      body["department"] !== undefined ? body["department"] : row["department"],
      body["startDate"] !== undefined ? body["startDate"] : row["start_date"],
      body["endDate"] !== undefined ? body["endDate"] : row["end_date"],
      body["venue"] !== undefined ? body["venue"] : row["venue"],
      body["status"] !== undefined ? body["status"] : row["status"],
      body["registrationSite"] !== undefined ? body["registrationSite"] : row["registration_site"],
      body["registrationFee"] !== undefined ? body["registrationFee"] : row["registration_fee"],
      body["prizePool"] !== undefined ? body["prizePool"] : row["prize_pool"],
      ctx.params[0],
    ]
  );
  await audit(ctx.user.id, ctx.user.role, "Updated event", ctx.params[0]);
  return ok({ ok: true });
}

async function analytics(_ctx: RouteCtx): Promise<HttpResponse> {
  const count = async (sql: string, params: unknown[] = []): Promise<number> =>
    num((await queryOne(sql, params))?.["n"]);

  const testSnapshots = (
    await query("SELECT * FROM v_test_snapshot ORDER BY submitted DESC, name")
  ).map((r) => ({
    testId: r["id"],
    testName: r["name"],
    submitted: r["submitted"],
    uniqueStudents: r["unique_students"],
    avgPercentage: r["avg_percentage"],
    bestPercentage: r["best_percentage"],
    published: r["published"],
  }));

  const top = (
    await query("SELECT * FROM v_leaderboard WHERE position = 1 ORDER BY percentage DESC LIMIT 10")
  ).map((r) => ({
    studentId: r["student_id"],
    studentName: r["student_name"],
    testId: r["test_id"],
    testName: r["test_name"],
    percentage: r["percentage"],
    score: r["score"],
    maxScore: r["max_score"],
  }));

  const tests = await query("SELECT id FROM tests ORDER BY id");
  const funnel: Record<string, unknown>[] = [];
  for (const r of tests) {
    funnel.push({
      testId: r["id"],
      students: await count("SELECT COUNT(*) n FROM student_test_assignments WHERE test_id = ?", [r["id"]]),
      started: await count("SELECT COUNT(*) n FROM attempts WHERE test_id = ? AND status != 'NOT_STARTED'", [r["id"]]),
      submitted: await count("SELECT COUNT(*) n FROM results WHERE test_id = ?", [r["id"]]),
    });
  }

  return ok({
    tests: testSnapshots,
    topPerformers: top,
    funnel,
    activity: {
      resultsToday: await count("SELECT COUNT(*) n FROM results WHERE submitted_at >= datetime('now','-1 day')"),
      activeTests: await count("SELECT COUNT(*) n FROM tests WHERE status='ACTIVE'"),
      pendingEditRequests: await count("SELECT COUNT(*) n FROM edit_requests WHERE status='PENDING'"),
      flaggedAttempts: await count("SELECT COUNT(DISTINCT attempt_id) n FROM security_events"),
    },
  });
}

async function adminListTests(_ctx: RouteCtx): Promise<HttpResponse> {
  const rows = await query(
    "SELECT t.id, t.name, t.type, t.status, t.question_count, t.duration_minutes, (SELECT COUNT(*) FROM student_test_assignments a WHERE a.test_id = t.id) assigned FROM tests t ORDER BY t.created_at DESC"
  );
  return ok({
    tests: rows.map((r) => ({
      id: r["id"],
      name: r["name"],
      type: r["type"],
      status: r["status"],
      questionCount: r["question_count"],
      durationMinutes: r["duration_minutes"],
      assignedStudents: r["assigned"],
    })),
  });
}

async function deleteAdminTest(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.params[0];
  const test = await queryOne("SELECT * FROM tests WHERE id = ?", [testId]);
  if (test === undefined) throw new ApiError(404, "Test not found.");
  if (["ACTIVE", "PAUSED"].includes(str(test["status"]))) {
    throw new ApiError(409, "End the test first — it is currently live.");
  }
  const attemptSub = "(SELECT id FROM attempts WHERE test_id = ?)";
  const children: [string, unknown[]][] = [
    ["DELETE FROM edit_requests WHERE attempt_id IN " + attemptSub, [testId]],
    ["DELETE FROM results WHERE attempt_id IN " + attemptSub, [testId]],
    ["DELETE FROM answers WHERE attempt_id IN " + attemptSub, [testId]],
    ["DELETE FROM frozen_questions WHERE attempt_id IN " + attemptSub, [testId]],
    ["DELETE FROM security_events WHERE attempt_id IN " + attemptSub + " OR test_id = ?", [testId, testId]],
  ];
  const direct: [string, unknown[]][] = [
    ["DELETE FROM attempts WHERE test_id = ?", [testId]],
    ["DELETE FROM timing_changes WHERE test_id = ?", [testId]],
    ["DELETE FROM test_questions WHERE test_id = ?", [testId]],
    ["DELETE FROM student_test_assignments WHERE test_id = ?", [testId]],
    ["DELETE FROM audit_logs WHERE target = ?", [testId]],
    ["DELETE FROM tests WHERE id = ?", [testId]],
  ];
  const counts: Record<string, number> = {};
  for (const [sql, args] of children) {
    counts[sql.split(" ")[2]] = await execute(sql, args);
  }
  for (const [sql, args] of direct) {
    counts[sql.split(" ")[2]] = await execute(sql, args);
  }
  await audit(ctx.user.id, ctx.user.role, "Deleted test data", testId, str(test["name"]));
  return ok({ ok: true, testId, name: test["name"], deleted: counts });
}

async function listAssignments(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.params[0];
  if (!(await queryOne("SELECT 1 FROM tests WHERE id = ?", [testId]))) throw new ApiError(404, "Test not found.");
  const rows = await query(
    "SELECT u.id, u.name, u.email, (SELECT 1 FROM attempts a WHERE a.test_id = ? AND a.student_id = u.id AND a.status != 'NOT_STARTED') started FROM student_test_assignments s JOIN users u ON u.id = s.student_id WHERE s.test_id = ? ORDER BY u.id",
    [testId, testId]
  );
  return ok({
    students: rows.map((r) => ({ id: r["id"], name: r["name"], email: r["email"], started: bool(r["started"]) })),
  });
}

async function assignStudents(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.params[0];
  if (!(await queryOne("SELECT 1 FROM tests WHERE id = ?", [testId]))) throw new ApiError(404, "Test not found.");
  const studentIds = ctx.body["studentIds"];
  if (!Array.isArray(studentIds)) throw new ApiError(400, "studentIds must be a list of student IDs.");
  let assigned = 0;
  const skipped: string[] = [];
  for (const raw of studentIds) {
    const studentId = str(raw).trim().toUpperCase();
    if (!studentId) continue;
    if (await queryOne("SELECT 1 FROM student_test_assignments WHERE test_id = ? AND student_id = ?", [testId, studentId])) {
      skipped.push(studentId);
      continue;
    }
    await execute("INSERT INTO student_test_assignments (test_id, student_id) VALUES (?, ?)", [testId, studentId]);
    assigned += 1;
  }
  await audit(ctx.user.id, ctx.user.role, "Assigned students to test", testId, `${assigned} assigned, ${skipped.length} already assigned`);
  return ok({ assigned, skipped });
}

async function unassignStudents(ctx: RouteCtx): Promise<HttpResponse> {
  const testId = ctx.params[0];
  if (!(await queryOne("SELECT 1 FROM tests WHERE id = ?", [testId]))) throw new ApiError(404, "Test not found.");
  const studentIds = ctx.body["studentIds"];
  if (!Array.isArray(studentIds)) throw new ApiError(400, "studentIds must be a list of student IDs.");
  let removed = 0;
  for (const raw of studentIds) {
    const studentId = str(raw).trim().toUpperCase();
    if (!studentId) continue;
    await execute("DELETE FROM student_test_assignments WHERE test_id = ? AND student_id = ?", [testId, studentId]);
    removed += 1;
  }
  await audit(ctx.user.id, ctx.user.role, "Unassigned students from test", testId, `${removed} removed`);
  return ok({ removed });
}

function crypto16(len: number): string {
  return Array.from(crypto.randomBytes(Math.ceil(len / 2)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(0, len);
}

export const adminRoutes: RouteDef[] = [
  { method: "GET", pattern: /^\/api\/admin\/overview$/, roles: SUPER_ADMIN, handler: overview },
  { method: "GET", pattern: /^\/api\/admin\/students$/, roles: SUPER_ADMIN, handler: students },
  { method: "POST", pattern: /^\/api\/admin\/students\/import$/, roles: SUPER_ADMIN, handler: importStudents },
  { method: "POST", pattern: /^\/api\/admin\/students$/, roles: SUPER_ADMIN, handler: createStudent },
  { method: "PUT", pattern: /^\/api\/admin\/students\/([^/]+)$/, roles: SUPER_ADMIN, handler: updateStudent },
  { method: "GET", pattern: /^\/api\/admin\/staff$/, roles: SUPER_ADMIN, handler: staffAccounts },
  { method: "POST", pattern: /^\/api\/admin\/staff$/, roles: SUPER_ADMIN, handler: createStaff },
  { method: "PUT", pattern: /^\/api\/admin\/staff\/([^/]+)$/, roles: SUPER_ADMIN, handler: updateStaff },
  { method: "PUT", pattern: /^\/api\/admin\/staff\/([^/]+)\/role$/, roles: SUPER_ADMIN, handler: assignStaffRole },
  { method: "GET", pattern: /^\/api\/admin\/events$/, roles: ["SUPER_ADMIN", "STAFF"], handler: events },
  { method: "POST", pattern: /^\/api\/admin\/events$/, roles: SUPER_ADMIN, handler: createEvent },
  { method: "PUT", pattern: /^\/api\/admin\/events\/([^/]+)$/, roles: SUPER_ADMIN, handler: updateEvent },
  { method: "GET", pattern: /^\/api\/admin\/analytics$/, roles: SUPER_ADMIN, handler: analytics },
  { method: "GET", pattern: /^\/api\/admin\/tests$/, roles: SUPER_ADMIN, handler: adminListTests },
  { method: "DELETE", pattern: /^\/api\/admin\/tests\/([^/]+)$/, roles: SUPER_ADMIN, handler: deleteAdminTest },
  { method: "GET", pattern: /^\/api\/admin\/tests\/([^/]+)\/assignments$/, roles: SUPER_ADMIN, handler: listAssignments },
  { method: "POST", pattern: /^\/api\/admin\/tests\/([^/]+)\/assign$/, roles: SUPER_ADMIN, handler: assignStudents },
  { method: "POST", pattern: /^\/api\/admin\/tests\/([^/]+)\/unassign$/, roles: SUPER_ADMIN, handler: unassignStudents },
];