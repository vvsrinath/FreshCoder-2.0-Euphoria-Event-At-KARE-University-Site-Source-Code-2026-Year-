/** Authentication and authorization. Enforced on every protected endpoint. */
import crypto from "node:crypto";
import { ApiError } from "./http";
import { config } from "./config";
import { execute, queryOne } from "./db";
import { utcNow } from "./utils";

const SALT_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const PBKDF2_ITERATIONS = 600000;

/** Matches Werkzeug generate_password_hash(method="pbkdf2:sha256", salt_length=16). */
export function hashPassword(raw: string): string {
  let salt = "";
  for (let i = 0; i < 16; i += 1) salt += SALT_CHARS[Math.floor(Math.random() * SALT_CHARS.length)];
  const hex = crypto.pbkdf2Sync(raw, salt, PBKDF2_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}$${salt}$${hex}`;
}

/** True for any Werkzeug pbkdf2:sha256 hash this backend may have written. */
export function verifyPassword(raw: string, stored: string): boolean {
  const parts = (stored || "").split("$");
  if (parts.length !== 3) return false;
  const method = parts[0];
  const salt = parts[1];
  const tail = parts[2];
  const match = /^pbkdf2:(\w+):(\d+)$/.exec(method);
  if (!match) return false;
  const digest = crypto.pbkdf2Sync(raw, salt, Number(match[2]), 32, match[1]).toString("hex");
  if (digest.length !== tail.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest, "utf-8"), Buffer.from(tail, "utf-8"));
}

export const DUMMY_HASH = hashPassword("dummy-password-for-constant-time");

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token, "utf-8").digest("hex");
}

export async function createSession(userId: string, role: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + config.sessionTtlHours * 3_600_000).toISOString().replace("Z", "+00:00");
  await execute(
    "INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    [tokenHash(token), userId, role, utcNow(), expires]
  );
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE token = ?", [tokenHash(token)]);
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

export interface AuthUser {
  id: string;
  role: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export async function currentUser(rawToken: string | null): Promise<{ user: AuthUser; token: string } | null> {
  if (!rawToken) return null;
  const session = await queryOne("SELECT * FROM sessions WHERE token = ?", [tokenHash(rawToken)]);
  if (session === undefined) return null;
  const expiresAt = new Date(String(session["expires_at"]).replace(" ", "T")).getTime();
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    await destroySession(rawToken);
    return null;
  }
  const row = await queryOne("SELECT * FROM users WHERE id = ?", [session["user_id"]]);
  if (row === undefined || !num_active(row["active"])) return null;
  const user: AuthUser = {
    id: String(row["id"]),
    role: String(row["role"]),
    name: String(row["name"]),
    email: String(row["email"] ?? ""),
    active: num_active(row["active"]),
    createdAt: String(row["created_at"] ?? ""),
  };
  return { user, token: rawToken };
}

function num_active(value: unknown): boolean {
  return value === 1 || value === 1n || value === true || String(value) === "1";
}

export async function requireAuth(rawToken: string | null, roles?: string[]): Promise<{ user: AuthUser; token: string }> {
  const auth = await currentUser(rawToken);
  if (auth === null) {
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
  if (roles && roles.length > 0 && !roles.includes(auth.user.role)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  return auth;
}