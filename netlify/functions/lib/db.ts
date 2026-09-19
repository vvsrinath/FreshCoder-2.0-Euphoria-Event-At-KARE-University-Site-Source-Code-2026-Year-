/** Turso (libsql) access helpers. All queries are parameterised. */
import { createClient, type Client, type InValue } from "@libsql/client";
import { config } from "./config";
import { utcNow } from "./utils";

export type Row = Record<string, unknown>;

let clientInstance: Client | null = null;

function getClient(): Client {
  if (!config.tursoDbUrl) throw new Error("TURSO_DB_URL is not configured.");
  if (clientInstance === null) {
    clientInstance = createClient({
      url: config.tursoDbUrl.replace(/^libsql:/, "https:"),
      authToken: config.tursoAuthToken || "",
    });
  }
  return clientInstance;
}

export async function query(sql: string, args: unknown[] = []): Promise<Row[]> {
  const result = await getClient().execute({ sql, args: args as InValue[] });
  return result.rows as Row[];
}

export async function queryOne(sql: string, args: unknown[] = []): Promise<Row | undefined> {
  const rows = await query(sql, args);
  return rows[0];
}

/** Runs a statement and returns the number of rows it affected. */
export async function execute(sql: string, args: unknown[] = []): Promise<number> {
  const result = await getClient().execute({ sql, args: args as InValue[] });
  return result.rowsAffected;
}

export function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function bool(value: unknown): boolean {
  return value === true || value === 1 || value === 1n || str(value) === "1";
}

export async function audit(
  actor: string,
  role: string,
  action: string,
  target = "",
  metadata = ""
): Promise<void> {
  await execute(
    "INSERT INTO audit_logs (actor, role, action, target, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [actor, role, action, target, metadata, utcNow()]
  );
}

export async function securityEvent(
  eventType: string,
  actor: string,
  role: string,
  detail = "",
  testId: string | null = null,
  attemptId: string | null = null
): Promise<void> {
  await execute(
    "INSERT INTO security_events (type, actor, role, test_id, attempt_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [eventType, actor, role, testId, attemptId, detail, utcNow()]
  );
}