"""Proctoring heuristics: turn raw security-event streams into risk scores.

The scores are advisory — a human proctor always makes the final call. The
weights below favour signals that strongly imply assistance (tab-hopping,
leaving the exam window, blocking the camera) over passive telemetry.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from database import query, query_one

SIGNALS_PATH = Path(__file__).parent / "data" / "monitoring_signals.json"


def _load_signal_weights() -> dict:
    raw = json.loads(SIGNALS_PATH.read_text(encoding="utf-8"))
    return {name: signal["weight"] for name, signal in raw.items()}


# Intent signals carry higher weight than passive browser telemetry. The
# weights live in data/monitoring_signals.json so proctors can tune them
# without touching code.
EVENT_WEIGHTS = _load_signal_weights()

WEIGHTED_TYPES = {key for key, weight in EVENT_WEIGHTS.items() if weight > 0}
KEEP_TYPES = WEIGHTED_TYPES | {"TEST_SUBMITTED", "FORCE_SUBMITTED", "SESSION_STARTED"}

# Bundling many events into a tiny window (copy/paste patterns, spamming the
# exam) is more suspicious than the same count spread over time.
BURST_WINDOW_SECONDS = 5.0
BURST_EXTRA_WEIGHT = 0.5


def _parse(value: str):
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace(" ", "T"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def event_weight(event_type: str) -> int:
    return EVENT_WEIGHTS.get(event_type, 0)


def _risk_level(score: float) -> str:
    if score <= 0:
        return "CLEAR"
    if score < 5:
        return "LOW"
    if score < 10:
        return "MODERATE"
    return "HIGH"


def attempt_risk(attempt_id: str) -> dict:
    """Score one attempt's monitoring-signal history."""
    events = query(
        "SELECT * FROM security_events WHERE attempt_id = ? ORDER BY created_at", (attempt_id,)
    )
    score = 0.0
    counts: dict = {}
    weights: dict = {}
    last_burst_start = None
    bursts = 0

    for event in events:
        event_type = event["type"]
        if event_type not in WEIGHTED_TYPES:
            continue
        weight = event_weight(event_type)
        counts[event_type] = counts.get(event_type, 0) + 1
        weights[event_type] = weights.get(event_type, 0) + weight
        score += weight

        created = _parse(event["created_at"])
        if created is not None:
            if last_burst_start is None or created - last_burst_start > timedelta(
                seconds=BURST_WINDOW_SECONDS
            ):
                bursts += 1
                last_burst_start = created
            else:
                # Subsequent events inside the same burst earn extra weight.
                score += BURST_EXTRA_WEIGHT

    top_type = max(counts, key=lambda k: counts[k]) if counts else None
    return {
        "attemptId": attempt_id,
        "eventTypes": sorted(counts),
        "counts": counts,
        "weights": weights,
        "bursts": bursts,
        "score": round(score, 1),
        "level": _risk_level(score),
        "topType": top_type,
    }


def risk_for_student(student_id: str) -> list:
    rows = query("SELECT id FROM attempts WHERE student_id = ?", (student_id,))
    return [attempt_risk(row["id"]) for row in rows]


def risk_by_student(test_id: str) -> list:
    """Rank every flagged student for one test, most risky first."""
    attempts = query(
        "SELECT a.id, a.student_id, a.status, u.name AS student_name"
        " FROM attempts a JOIN users u ON u.id = a.student_id WHERE a.test_id = ?",
        (test_id,),
    )
    report = []
    for attempt in attempts:
        risk = attempt_risk(attempt["id"])
        if risk["score"] <= 0:
            continue
        report.append(
            {
                "studentId": attempt["student_id"],
                "studentName": attempt["student_name"],
                "attemptId": attempt["id"],
                "status": attempt["status"],
                **risk,
            }
        )
    return sorted(report, key=lambda r: (-r["score"], r["studentId"]))


def evaluate_generic_flags() -> dict:
    """Cross-test view: counts recent suspicious signals across all attempts."""
    recent = datetime.now(timezone.utc) - timedelta(days=1)
    return {
        "intentSignals": {
            event_type: query_one(
                "SELECT COUNT(*) AS n FROM security_events"
                " WHERE type = ? AND created_at >= ?",
                (event_type, recent.isoformat()),
            )["n"]
            for event_type in sorted(WEIGHTED_TYPES)
        }
    }