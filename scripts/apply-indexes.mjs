/**
 * Idempotent schema migrations for the remote Turso database.
 * Runs automatically after every Netlify build (site env supplies
 * TURSO_DB_URL / TURSO_AUTH_TOKEN). Safe to skip locally without env vars.
 */
import { createClient } from "@libsql/client/web";

const url = process.env.TURSO_DB_URL || "";
const token = process.env.TURSO_AUTH_TOKEN || "";
if (!url || !token) {
  console.log("[apply-indexes] TURSO_DB_URL/TURSO_AUTH_TOKEN not set — skipping.");
  process.exit(0);
}

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_results_student_published ON results(student_id, published)",
  "CREATE INDEX IF NOT EXISTS idx_tests_scheduled ON tests(scheduled_start)",
  "CREATE INDEX IF NOT EXISTS idx_answers_attempt_q ON answers(attempt_id, question_id)",
];

const MIGRATIONS = [
  "ALTER TABLE tests ADD COLUMN practice INTEGER NOT NULL DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, message TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, expires_at TEXT)",
];

// Remove residue created during live smoke tests (idempotent; already-deleted
// ids are no-ops). Children first, in FK-safe order, scoped by attempts under
// the test so any number of attempts for the test are covered.
const TEST_RESIDUE = ["T2B4E0C83", "TC264F77A", "T66B4B88E", "TAABC3492", "T22B2EB24", "TF87D0B2A"];
const CLEANUPS = TEST_RESIDUE.flatMap((tid) => [
  `DELETE FROM security_events WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = '${tid}')`,
  `DELETE FROM frozen_questions WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = '${tid}')`,
  `DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = '${tid}')`,
  `DELETE FROM edit_requests WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = '${tid}') OR test_id = '${tid}'`,
  `DELETE FROM results WHERE test_id = '${tid}'`,
  `DELETE FROM attempts WHERE test_id = '${tid}'`,
  `DELETE FROM test_questions WHERE test_id = '${tid}'`,
  `DELETE FROM student_test_assignments WHERE test_id = '${tid}'`,
  `DELETE FROM timing_changes WHERE test_id = '${tid}'`,
  `DELETE FROM security_events WHERE test_id = '${tid}'`,
  `DELETE FROM tests WHERE id = '${tid}'`,
]);

// Test-added questions left orphaned by the residue above (referenced only by
// those now-deleted attempts/test_questions). Delete after the test cascade.
const QUESTION_RESIDUE = ["QE369B2"];
for (const qid of QUESTION_RESIDUE) {
  CLEANUPS.push(`DELETE FROM questions WHERE id = '${qid}'`);
}

const client = createClient({
  url: url.replace(/^libsql:/, "https:"),
  authToken: token,
});

try {
  for (const sql of INDEXES) {
    const before = await client.execute(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'"
    );
    await client.execute(sql);
    const after = await client.execute(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'"
    );
    console.log(
      `[apply-indexes] ${sql.split(" ON ")[0].replace("CREATE INDEX IF NOT EXISTS ", "").trim()} → ${after.rows[0].n} index rows (${before.rows[0].n} → ${after.rows[0].n})`
    );
  }
  for (const sql of MIGRATIONS) {
    try {
      await client.execute(sql);
      console.log(`[apply-indexes] migration ok: ${sql}`);
    } catch (error) {
      if (/duplicate column|already exists/i.test(error.message)) {
        console.log(`[apply-indexes] migration already applied: ${sql}`);
      } else {
        throw error;
      }
    }
  }
  for (const sql of CLEANUPS) {
    try {
      const res = await client.execute(sql);
      const affected = typeof res.rowsAffected === "bigint" ? res.rowsAffected.toString() : String(res.rowsAffected ?? 0);
      console.log(`[apply-indexes] cleanup ok (${affected} rows): ${sql}`);
    } catch (error) {
      console.warn(`[apply-indexes] cleanup skipped (${error.message}): ${sql}`);
    }
  }
  console.log("[apply-indexes] done.");
} catch (error) {
  console.error("[apply-indexes] failed:", error.message);
  process.exit(1);
}