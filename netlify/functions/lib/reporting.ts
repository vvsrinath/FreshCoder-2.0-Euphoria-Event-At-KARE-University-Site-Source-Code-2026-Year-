/** Server-side reporting and analytics (mirrors src/backend/reporting.py). */
import { query, queryOne, num, str, type Row } from "./db";
import { csv } from "./http";

export const CSV_COLUMNS: string[] = [
  "Student ID",
  "Student Name",
  "Test ID",
  "Test Name",
  "Score",
  "Max Score",
  "Percentage",
  "Correct",
  "Wrong",
  "Unanswered",
  "Time (min)",
  "Submitted At",
  "Published",
];

export const SCORE_BUCKETS = ["A (90-100)", "B (75-89)", "C (50-74)", "D (<50)"];

function loadBreakdown(row: Row | undefined): Record<string, unknown>[] {
  if (!row || !("breakdown" in row)) return [];
  const raw = row["breakdown"];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function scoreBucket(percentage: number): string {
  if (percentage >= 90) return "A (90-100)";
  if (percentage >= 75) return "B (75-89)";
  if (percentage >= 50) return "C (50-74)";
  return "D (<50)";
}

export async function testSummary(testId: string): Promise<Record<string, unknown>> {
  const rows = await query("SELECT * FROM results WHERE test_id = ?", [testId]);
  if (rows.length === 0) {
    return {
      testId,
      submitted: 0,
      published: 0,
      avgScore: 0,
      medianScore: 0,
      maxScore: 0,
      minScore: 0,
      avgPercentage: 0,
      avgTimeSeconds: 0,
      buckets: Object.fromEntries(SCORE_BUCKETS.map((b) => [b, 0])),
    };
  }

  const scores = rows.map((r) => num(r["score"]));
  const percentages = rows.map((r) => num(r["percentage"]));
  const times = rows.map((r) => num(r["time_used_seconds"]));
  const buckets = Object.fromEntries(SCORE_BUCKETS.map((b) => [b, 0]));
  for (const row of rows) buckets[scoreBucket(num(row["percentage"]))] += 1;

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const median = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const round1 = (x: number) => Math.round(x * 10) / 10;

  return {
    testId,
    submitted: rows.length,
    published: rows.filter((r) => Number(r["published"]) === 1).length,
    avgScore: round1(mean(scores)),
    medianScore: round1(median(scores)),
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    avgPercentage: round1(mean(percentages)),
    avgTimeSeconds: Math.floor(mean(times)),
    buckets,
  };
}

export async function questionLevelAnalytics(testId: string): Promise<Record<string, unknown>[]> {
  const rows = await query("SELECT * FROM results WHERE test_id = ?", [testId]);
  const acc: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const pct = num(row["percentage"]);
    for (const entry of loadBreakdown(row)) {
      const questionId = str(entry["questionId"]);
      if (!questionId) continue;
      const bucket =
        acc[questionId] ??
        {
          questionId,
          instances: 0,
          correct: 0,
          avgAwarded: 0,
          totalMarks: 0,
          rightSum: 0,
          rightN: 0,
          wrongSum: 0,
          wrongN: 0,
        };
      bucket["instances"] += 1;
      bucket["totalMarks"] += num(entry["marks"]);
      bucket["avgAwarded"] += num(entry["awarded"]);
      const ivCorrect = entry["correct"] === true;
      if (ivCorrect) {
        bucket["correct"] += 1;
        bucket["rightSum"] += pct;
        bucket["rightN"] += 1;
      } else if (str(entry["given"] ?? "").trim() !== "") {
        bucket["wrongSum"] += pct;
        bucket["wrongN"] += 1;
      }
      acc[questionId] = bucket;
    }
  }
  const out: Record<string, number | string | null>[] = Object.values(acc).map((bucket) => {
    const instances = numberOrOne(bucket);
    const rightMean = bucket["rightN"] ? bucket["rightSum"] / Number(bucket["rightN"]) : null;
    const wrongMean = bucket["wrongN"] ? bucket["wrongSum"] / Number(bucket["wrongN"]) : null;
    const discrimination =
      rightMean !== null && wrongMean !== null ? Math.round((rightMean - wrongMean) * 100) / 100 : null;
    return {
      ...bucket,
      avgAwarded: Math.round((bucket["avgAwarded"] / instances) * 100) / 100,
      difficultyIndex: Math.round((bucket["correct"] / instances) * 1000) / 1000,
      discrimination,
    };
  });
  const ids = out.map((b) => String(b["questionId"])).filter(Boolean);
  const titles = new Map<string, string>();
  if (ids.length > 0) {
    const placeholder = ids.map(() => "?").join(",");
    const rows = await query("SELECT id, title FROM questions WHERE id IN (" + placeholder + ")", ids);
    for (const r of rows) titles.set(str(r["id"]), str(r["title"]));
  }
  for (const bucket of out) {
    bucket["title"] = titles.get(String(bucket["questionId"])) ?? String(bucket["questionId"]);
  }
  return out.sort((a, b) => num(a["difficultyIndex"]) - num(b["difficultyIndex"]));
}

function numberOrOne(bucket: Record<string, number>): number {
  return bucket["instances"] || 1;
}

export async function resultsCsvRows(testId: string): Promise<string[][]> {
  const rows = await query(
    "SELECT r.*, u.name AS student_name, t.name AS test_name FROM results r JOIN users u ON u.id = r.student_id JOIN tests t ON t.id = r.test_id WHERE r.test_id = ? ORDER BY r.submitted_at",
    [testId]
  );
  return rows.map((r) => [
    str(r["student_id"]),
    str(r["student_name"]),
    str(r["test_id"]),
    str(r["test_name"]),
    str(r["score"]),
    str(r["max_score"]),
    str(r["percentage"]),
    str(r["correct"]),
    str(r["wrong"]),
    str(r["unanswered"]),
    String(Math.round(num(r["time_used_seconds"]) / 60 * 10) / 10),
    str(r["submitted_at"]),
    Number(r["published"]) === 1 ? "yes" : "no",
  ]);
}

export async function buildResultsCsv(testId: string): Promise<string> {
  const lines = [CSV_COLUMNS, ...(await resultsCsvRows(testId))];
  return lines.map((line) => csv(line)).join("\r\n");
}