/** Auth and developer routes (mirrors src/backend/routes/auth_routes.py). */
import { ApiError, HttpResponse, ok } from "../http";
import { config } from "../config";
import { execute, queryOne, num, str, bool, audit, securityEvent, type Row } from "../db";
import {
  DUMMY_HASH,
  createSession,
  destroySession,
  currentUser,
  hashPassword,
  verifyPassword,
} from "../auth";
import { RouteCtx, RouteDef } from "../router";
import { utcNow } from "../utils";
import { passwordError } from "../policy";

const PORTAL_ROLES: Record<string, string[]> = {
  STUDENT: ["STUDENT"],
  STAFF: ["STAFF"],
  ADMIN: ["SUPER_ADMIN", "DEVELOPER"],
};

const MONITORING_EVENTS = new Set([
  "FULLSCREEN_EXIT",
  "TAB_VISIBILITY_CHANGE",
  "NAVIGATION_ATTEMPT",
  "CONTEXT_MENU_BLOCKED",
  "COPY_BLOCKED",
]);

// In-memory login throttle keyed by user + IP. Acceptable for a single-site event.
const failures = new Map<string, number[]>();

function loginKey(userId: string, ip: string): string {
  return `${userId}|${ip}`;
}

function checkThrottled(userId: string, ip: string): boolean {
  const now = Date.now();
  const key = loginKey(userId, ip);
  const windowMs = config.loginWindowMinutes * 60_000;
  const fresh = (failures.get(key) ?? []).filter((t) => now - t < windowMs);
  failures.set(key, fresh);
  return fresh.length >= config.loginMaxAttempts;
}

function recordFailure(userId: string, ip: string): void {
  const key = loginKey(userId, ip);
  const list = failures.get(key) ?? [];
  list.push(Date.now());
  failures.set(key, list);
}

function recordSuccess(userId: string, ip: string): void {
  failures.delete(loginKey(userId, ip));
}

function publicUser(row: Row): Record<string, unknown> {
  return {
    id: row["id"],
    role: row["role"],
    name: row["name"],
    email: row["email"],
    active: bool(row["active"]),
  };
}

async function login(ctx: RouteCtx): Promise<HttpResponse> {
  const userId = String(ctx.body["userId"] ?? "").trim().toUpperCase();
  const password = String(ctx.body["password"] ?? "");
  const portal = String(ctx.body["portal"] ?? "");

  if (!userId || !password) throw new ApiError(400, "Enter your ID and password to continue.");
  if (checkThrottled(userId, ctx.ip)) {
    await securityEvent(
      "LOGIN_THROTTLED",
      userId,
      "SYSTEM",
      `Login blocked ${config.loginMaxAttempts}+ failures in ${config.loginWindowMinutes} minutes`
    );
    throw new ApiError(429, "Too many attempts. Try again later.");
  }

  const user = await queryOne("SELECT * FROM users WHERE UPPER(id) = ?", [userId]);
  let valid = user !== undefined && verifyPassword(password, str(user["password_hash"]));
  if (user === undefined) verifyPassword(password, DUMMY_HASH);

  if (user === undefined || !valid) {
    recordFailure(userId, ctx.ip);
    await securityEvent("LOGIN_FAILURE", userId, "SYSTEM", `Failed login on ${portal} portal`);
    throw new ApiError(401, "Invalid credentials. Please check your ID and password.");
  }
  if (!bool(user["active"])) {
    recordFailure(userId, ctx.ip);
    throw new ApiError(403, "This account has been deactivated.");
  }
  if (portal && !(PORTAL_ROLES[portal] ?? []).includes(str(user["role"]))) {
    recordFailure(userId, ctx.ip);
    await securityEvent("LOGIN_FAILURE", str(user["id"]), str(user["role"]), `Wrong portal (${portal})`);
    throw new ApiError(403, "This account cannot sign in from this portal.");
  }

  // Multi-device: allowed for every role like staff/admin. Flag it for proctoring.
  if (str(user["role"]) === "STUDENT") {
    const existing = await queryOne("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", [user["id"]]);
    if (existing && num(existing["n"]) > 0) {
      await securityEvent(
        "MULTIPLE_SESSION_DETECTED",
        str(user["id"]),
        str(user["role"]),
        `Student signed in on another device (${portal} portal)`
      );
    }
  }

  recordSuccess(userId, ctx.ip);
  const token = await createSession(str(user["id"]), str(user["role"]));
  await securityEvent("LOGIN_SUCCESS", str(user["id"]), str(user["role"]), `Signed in via ${portal}`);
  await securityEvent("SESSION_STARTED", str(user["id"]), str(user["role"]), "Session started");
  return ok({ token, user: publicUser(user) });
}

async function logout(ctx: RouteCtx): Promise<HttpResponse> {
  const auth = await currentUser(ctx.token);
  if (auth) {
    await destroySession(auth.token);
    await securityEvent("SESSION_ENDED", auth.user.id, auth.user.role, "Signed out");
  }
  return ok({ ok: true });
}

async function me(ctx: RouteCtx): Promise<HttpResponse> {
  return ok({ user: publicUser({ id: ctx.user.id, role: ctx.user.role, name: ctx.user.name, email: ctx.user.email, active: ctx.user.active }) });
}

async function changePassword(ctx: RouteCtx): Promise<HttpResponse> {
  const current = String(ctx.body["currentPassword"] ?? "");
  const next = String(ctx.body["newPassword"] ?? "");
  const passwordMessage = passwordError(next);
  if (passwordMessage) throw new ApiError(400, passwordMessage);
  const row = await queryOne("SELECT password_hash FROM users WHERE id = ?", [ctx.user.id]);
  if (row === undefined) throw new ApiError(404, "Account not found.");
  if (!verifyPassword(current, str(row["password_hash"]))) {
    await securityEvent("PASSWORD_CHANGE_FAILED", ctx.user.id, ctx.user.role, "Wrong current password");
    throw new ApiError(400, "Your current password is incorrect.");
  }
  if (verifyPassword(next, str(row["password_hash"]))) throw new ApiError(400, "New password must be different.");
  await execute("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(next), ctx.user.id]);
  await securityEvent("PASSWORD_CHANGED", ctx.user.id, ctx.user.role, "Password changed");
  await audit(ctx.user.id, ctx.user.role, "Changed password", ctx.user.id);
  return ok({ ok: true });
}

async function reportEvent(ctx: RouteCtx): Promise<HttpResponse> {
  const eventType = String(ctx.body["type"] ?? "");
  if (!MONITORING_EVENTS.has(eventType)) throw new ApiError(400, "Unknown monitoring signal.");
  const detail = String(ctx.body["detail"] ?? "").slice(0, 500);
  const attemptId = ctx.body["attemptId"] === undefined || ctx.body["attemptId"] === null
    ? null
    : String(ctx.body["attemptId"]);
  if (attemptId && ctx.user.role === "STUDENT") {
    const attempt = await queryOne("SELECT 1 FROM attempts WHERE id = ? AND student_id = ?", [
      attemptId,
      ctx.user.id,
    ]);
    if (attempt === undefined) throw new ApiError(400, "Unknown attempt.");
  }
  await securityEvent(eventType, ctx.user.id, ctx.user.role, detail, null, attemptId);
  return ok({ ok: true });
}

async function initSuperAdmin(ctx: RouteCtx): Promise<HttpResponse> {
  if (ctx.user.role !== "DEVELOPER") {
    throw new ApiError(403, "Only the developer account can initialise a Super Admin.");
  }
  const userId = String(ctx.body["id"] ?? "").trim().toUpperCase();
  const name = ctx.body["name"] === undefined ? "" : String(ctx.body["name"]);
  const password = String(ctx.body["password"] ?? "");
  if (!userId || !name || !password) throw new ApiError(400, "ID, name and password are required.");
  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long.");
  }
  if (await queryOne("SELECT 1 FROM users WHERE id = ?", [userId])) {
    throw new ApiError(409, "That ID already exists.");
  }
  await execute(
    "INSERT INTO users (id, role, name, email, password_hash, active, created_at) VALUES (?, 'SUPER_ADMIN', ?, ?, ?, 1, ?)",
    [userId, name, str(ctx.body["email"] ?? ""), hashPassword(password), utcNow()]
  );
  await audit(ctx.user.id, ctx.user.role, "Initialised Super Admin", userId);
  return ok({ ok: true });
}

export const authRoutes: RouteDef[] = [
  { method: "POST", pattern: /^\/api\/auth\/login$/, roles: [], handler: login },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, roles: [], handler: logout },
  { method: "GET", pattern: /^\/api\/auth\/me$/, roles: null, handler: me },
  { method: "POST", pattern: /^\/api\/auth\/security-event$/, roles: null, handler: reportEvent },
  { method: "POST", pattern: /^\/api\/auth\/change-password$/, roles: null, handler: changePassword },
  { method: "POST", pattern: /^\/api\/developer\/init-super-admin$/, roles: null, handler: initSuperAdmin },
];