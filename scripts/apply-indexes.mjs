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
  console.log("[apply-indexes] done.");
} catch (error) {
  console.error("[apply-indexes] failed:", error.message);
  process.exit(1);
}