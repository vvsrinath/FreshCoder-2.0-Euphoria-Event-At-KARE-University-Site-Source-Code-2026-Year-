/** Log exports as CSV (mirrors src/backend/export.py). */
import { query, str } from "./db";
import { csv } from "./http";

export const AUDIT_COLUMNS = ["id", "actor", "role", "action", "target", "metadata", "createdAt"];
export const SECURITY_COLUMNS = ["id", "type", "actor", "role", "testId", "attemptId", "detail", "createdAt"];

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns];
  for (const row of rows) {
    lines.push(columns.map((col) => (row[col] === null || row[col] === undefined ? "" : str(row[col]))));
  }
  return lines.map((line) => csv(line)).join("\r\n");
}

export async function auditLogsCsv(term = ""): Promise<string> {
  let sql =
    "SELECT id, actor, role, action, target, metadata, created_at AS createdAt FROM audit_logs WHERE 1 = 1";
  const params: string[] = [];
  if (term) {
    sql += " AND (LOWER(actor) LIKE ? OR LOWER(action) LIKE ? OR LOWER(target) LIKE ?)";
    const pattern = `%${term.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }
  const rows = await query(sql + " ORDER BY id DESC LIMIT 5000", params);
  return rowsToCsv(AUDIT_COLUMNS, rows);
}

export async function securityEventsCsv(testId = ""): Promise<string> {
  let sql =
    "SELECT id, type, actor, role, test_id AS testId, attempt_id AS attemptId, detail, created_at AS createdAt FROM security_events WHERE 1 = 1";
  const params: string[] = [];
  if (testId) {
    sql += " AND test_id = ?";
    params.push(testId);
  }
  const rows = await query(sql + " ORDER BY id DESC LIMIT 5000", params);
  return rowsToCsv(SECURITY_COLUMNS, rows);
}