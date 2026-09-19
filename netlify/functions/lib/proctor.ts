/** Proctoring heuristics: turn raw security-event streams into risk scores. */
import { query, queryOne, num, str } from "./db";

// Weights live beside the Flask backend too (data/monitoring_signals.json).
import { parseUtc } from "./utils";

const SIGNAL_WEIGHTS: Record<string, number> = {
  FULLSCREEN_EXIT: 2,
  TAB_VISIBILITY_CHANGE: 1,
  NAVIGATION_ATTEMPT: 4,
  CONTEXT_MENU_BLOCKED: 1,
  COPY_BLOCKED: 1,
  LOGIN_FAILURE: 2,
  MULTIPLE_SESSION_DETECTED: 5,
  LOGIN_THROTTLED: 3,
};

const WEIGHTED_TYPES = Object.entries(SIGNAL_WEIGHTS)
  .filter(([, weight]) => weight > 0)
  .map(([name]) => name);

const BURST_WINDOW_MS = 5000;
const BURST_EXTRA_WEIGHT = 0.5;

function riskLevel(score: number): string {
  if (score <= 0) return "CLEAR";
  if (score < 5) return "LOW";
  if (score < 10) return "MODERATE";
  return "HIGH";
}

export async function attemptRisk(attemptId: string): Promise<Record<string, unknown>> {
  const events = await query("SELECT * FROM security_events WHERE attempt_id = ? ORDER BY created_at", [attemptId]);
  let score = 0;
  const counts: Record<string, number> = {};
  const weights: Record<string, number> = {};
  let lastBurstStart: Date | undefined;
  let bursts = 0;

  for (const event of events) {
    const eventType = str(event["type"]);
    if (!WEIGHTED_TYPES.includes(eventType)) continue;
    const weight = SIGNAL_WEIGHTS[eventType] ?? 0;
    counts[eventType] = (counts[eventType] ?? 0) + 1;
    weights[eventType] = (weights[eventType] ?? 0) + weight;
    score += weight;

    const created = parseUtc(str(event["created_at"]));
    if (created) {
      if (lastBurstStart === undefined || created.getTime() - lastBurstStart.getTime() > BURST_WINDOW_MS) {
        bursts += 1;
        lastBurstStart = created;
      } else {
        score += BURST_EXTRA_WEIGHT;
      }
    }
  }

  const topType = Object.keys(counts).length ? Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] : null;
  return {
    attemptId,
    eventTypes: Object.keys(counts).sort(),
    counts,
    weights,
    bursts,
    score: Math.round(score * 10) / 10,
    level: riskLevel(score),
    topType,
  };
}

export async function riskByStudent(testId: string): Promise<Record<string, unknown>[]> {
  const attempts = await query(
    "SELECT a.id, a.student_id, a.status, u.name AS student_name FROM attempts a JOIN users u ON u.id = a.student_id WHERE a.test_id = ?",
    [testId]
  );
  const report: Record<string, unknown>[] = [];
  for (const attempt of attempts) {
    const risk = await attemptRisk(String(attempt["id"]));
    if (num(risk["score"]) <= 0) continue;
    report.push({
      studentId: attempt["student_id"],
      studentName: attempt["student_name"],
      attemptId: attempt["id"],
      status: attempt["status"],
      ...risk,
    });
  }
  return report.sort((a, b) => {
    const diff = num(b["score"]) - num(a["score"]);
    return diff !== 0 ? diff : String(a["studentId"]).localeCompare(String(b["studentId"]));
  });
}

export async function evaluateGenericFlags(): Promise<Record<string, unknown>> {
  const since = new Date(Date.now() - 86_400_000).toISOString().replace("Z", "+00:00");
  const intentSignals: Record<string, number> = {};
  for (const eventType of [...WEIGHTED_TYPES].sort()) {
    const row = await queryOne(
      "SELECT COUNT(*) AS n FROM security_events WHERE type = ? AND created_at >= ?",
      [eventType, since]
    );
    intentSignals[eventType] = num(row ? row["n"] : 0);
  }
  return { intentSignals };
}