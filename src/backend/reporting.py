"""Server-side reporting and analytics.

All aggregates are computed here, never on the client. Queries stay
parameterised; analysis only reads already-stored, frozen result data.
"""
import csv
import io
import json
from statistics import mean, median

from database import loads, query, query_one

CSV_COLUMNS = (
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
)


def _test_exists(test_id) -> bool:
    return query_one("SELECT 1 FROM tests WHERE id = ?", (test_id,)) is not None


def _load_breakdown(row):
    if row is None or "breakdown" not in row.keys():
        return []
    raw = row["breakdown"]
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return []
    if isinstance(raw, list):
        return raw
    return []


def _score_bucket(percentage: float) -> str:
    if percentage >= 90:
        return "A (90-100)"
    if percentage >= 75:
        return "B (75-89)"
    if percentage >= 50:
        return "C (50-74)"
    return "D (<50)"


SCORE_BUCKETS = ("A (90-100)", "B (75-89)", "C (50-74)", "D (<50)")


def test_summary(test_id: str) -> dict:
    """High-level statistics for one test."""
    rows = query("SELECT * FROM results WHERE test_id = ?", (test_id,))
    if not rows:
        return {
            "testId": test_id,
            "submitted": 0,
            "published": 0,
            "avgScore": 0,
            "medianScore": 0,
            "maxScore": 0,
            "minScore": 0,
            "avgPercentage": 0,
            "avgTimeSeconds": 0,
            "buckets": {label: 0 for label in SCORE_BUCKETS},
        }

    scores = [r["score"] for r in rows]
    percentages = [r["percentage"] for r in rows]
    times = [r["time_used_seconds"] for r in rows]
    buckets = {label: 0 for label in SCORE_BUCKETS}
    for row in rows:
        buckets[_score_bucket(row["percentage"])] += 1

    return {
        "testId": test_id,
        "submitted": len(rows),
        "published": sum(1 for r in rows if r["published"]),
        "avgScore": round(mean(scores), 1),
        "medianScore": round(median(scores), 1),
        "maxScore": max(scores),
        "minScore": min(scores),
        "avgPercentage": round(mean(percentages), 1),
        "avgTimeSeconds": int(mean(times)),
        "buckets": buckets,
    }


def question_level_analytics(test_id: str) -> list:
    """Per-question difficulty for a test, from frozen breakdown data."""
    rows = query("SELECT * FROM results WHERE test_id = ?", (test_id,))
    acc: dict = {}
    for row in rows:
        for entry in _load_breakdown(row):
            question_id = entry.get("questionId")
            if not question_id:
                continue
            bucket = acc.setdefault(
                question_id,
                {"questionId": question_id, "instances": 0, "correct": 0, "avgAwarded": 0.0, "totalMarks": 0},
            )
            bucket["instances"] += 1
            bucket["totalMarks"] += entry.get("marks") or 0
            if entry.get("correct") is True:
                bucket["correct"] += 1
            bucket["avgAwarded"] += entry.get("awarded") or 0
    for question_id, bucket in acc.items():
        instances = bucket["instances"] or 1
        bucket["avgAwarded"] = round(bucket["avgAwarded"] / instances, 2)
        bucket["difficultyIndex"] = round(bucket["correct"] / instances, 3)
        title = query_one("SELECT title FROM questions WHERE id = ?", (question_id,))
        bucket["title"] = title["title"] if title else question_id
    return sorted(acc.values(), key=lambda b: b["difficultyIndex"])


def results_csv_rows(test_id: str) -> list:
    """Rows ready for CSV export, one per submitted result."""
    rows = query(
        "SELECT r.*, u.name AS student_name, t.name AS test_name"
        " FROM results r JOIN users u ON u.id = r.student_id JOIN tests t ON t.id = r.test_id"
        " WHERE r.test_id = ? ORDER BY r.submitted_at",
        (test_id,),
    )
    return [
        {
            CSV_COLUMNS[i]: value
            for i, value in enumerate(
                [
                    r["student_id"],
                    r["student_name"],
                    r["test_id"],
                    r["test_name"],
                    r["score"],
                    r["max_score"],
                    r["percentage"],
                    r["correct"],
                    r["wrong"],
                    r["unanswered"],
                    round(r["time_used_seconds"] / 60, 1),
                    r["submitted_at"],
                    "yes" if r["published"] else "no",
                ]
            )
        }
        for r in rows
    ]


def build_results_csv(test_id: str) -> str:
    """Return the download-ready CSV text for one test."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    writer.writerows(results_csv_rows(test_id))
    return buffer.getvalue()