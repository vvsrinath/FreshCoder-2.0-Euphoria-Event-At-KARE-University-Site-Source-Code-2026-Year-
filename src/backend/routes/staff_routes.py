import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Blueprint, Response, g, jsonify, request

from auth import roles_required
from database import audit, execute, loads, query, query_one, security_event, utc_now
from routes.student_routes import finalize_attempt
from reporting import build_results_csv, question_level_analytics, test_summary
from proctor import evaluate_generic_flags, risk_by_student
from export import audit_logs_csv, security_events_csv

DISTRIBUTION_PRESETS = json.loads(
    (Path(__file__).resolve().parent.parent / "data" / "distribution_presets.json").read_text(encoding="utf-8")
)

staff_bp = Blueprint("staff", __name__, url_prefix="/api")

ALLOWED_TRANSITIONS = {
    "DRAFT": {"SCHEDULED", "ARCHIVED"},
    "SCHEDULED": {"ACTIVE", "DRAFT", "ARCHIVED", "SCHEDULED"},
    "ACTIVE": {"PAUSED", "COMPLETED"},
    "PAUSED": {"ACTIVE", "COMPLETED", "PAUSED"},
    "COMPLETED": {"ARCHIVED"},
    "ARCHIVED": set(),
}

STAFF = ("STAFF", "SUPER_ADMIN")

QUESTION_TYPES = {
    "MCQ", "TRUE_FALSE", "FILL_BLANK", "OUTPUT", "CODE_COMPLETION", "DEBUGGING", "CODING",
}
TEST_TYPES = {"QUIZ", "MCQ", "FILL_BLANK", "OUTPUT", "CODE_COMPLETION", "DEBUGGING", "CODING", "MIXED"}
DIFFICULTIES = {"EASY", "MEDIUM", "HARD"}
STATUSES = {"ACTIVE", "DRAFT", "ARCHIVED"}
SELECTION_MODES = {"RANDOM", "MANUAL", "DISTRIBUTION"}


def parse_utc(value: str):
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace(" ", "T"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def safe_int(value, field: str, default=None, minimum=0, maximum=10**6):
    """Return an int or raise a 400 with a clean message."""
    if value in (None, ""):
        if default is not None:
            return default
        raise ValueError(f"{field} is required.")
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a whole number.")
    if isinstance(value, bool):
        raise ValueError(f"{field} must be a whole number.")
    if number < minimum:
        raise ValueError(f"{field} must be at least {minimum}.")
    if number > maximum:
        raise ValueError(f"{field} is too large.")
    return number


def test_to_json(row) -> dict:
    return {
        "id": row["id"],
        "eventId": row["event_id"],
        "name": row["name"],
        "description": row["description"],
        "type": row["type"],
        "questionCount": row["question_count"],
        "durationMinutes": row["duration_minutes"],
        "selectionMode": row["selection_mode"],
        "distribution": loads(row["distribution"], {}),
        "manualQuestionIds": loads(row["manual_question_ids"], []),
        "scheduledStart": row["scheduled_start"],
        "status": row["status"],
        "resultsPublished": bool(row["results_published"]),
        "startedAt": row["started_at"],
        "stoppedAt": row["stopped_at"],
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
    }


def question_to_json(row) -> dict:
    return {
        "id": row["id"],
        "version": row["version"],
        "title": row["title"],
        "type": row["type"],
        "topic": row["topic"],
        "difficulty": row["difficulty"],
        "marks": row["marks"],
        "status": row["status"],
        "prompt": row["prompt"],
        "code": row["code"],
        "options": loads(row["options"], None),
        "answer": row["answer"],
        "alternatives": loads(row["alternatives"], []),
        "explanation": row["explanation"],
        "inputFormat": row["input_format"],
        "outputFormat": row["output_format"],
        "constraints": row["constraints"],
        "sampleInput": row["sample_input"],
        "sampleOutput": row["sample_output"],
        "testCases": loads(row["test_cases"], []),
        "createdBy": row["created_by"],
        "createdAt": row["created_at"],
    }


def timing_change_to_json(row) -> dict:
    return {
        "id": row["id"],
        "testId": row["test_id"],
        "oldDuration": row["old_duration"],
        "newDuration": row["new_duration"],
        "staffId": row["staff_id"],
        "reason": row["reason"],
        "createdAt": row["created_at"],
    }


def version_to_json(row) -> dict:
    return {
        "id": row["id"],
        "questionId": row["question_id"],
        "version": row["version"],
        "snapshot": loads(row["snapshot"], None),
        "changedBy": row["changed_by"],
        "reason": row["reason"],
        "createdAt": row["created_at"],
    }


def distribution_total(distribution: dict) -> int:
    total = 0
    for v in distribution.values():
        try:
            n = int(v)
        except (TypeError, ValueError):
            raise ValueError("The question distribution must contain whole numbers.")
        if n < 0:
            raise ValueError("The question distribution cannot contain negative counts.")
        total += n
    return total


# ---------------------------------------------------------------- dashboard
@staff_bp.get("/staff/tests/presets")
@roles_required(*STAFF)
def test_presets():
    return jsonify({"distributionPresets": DISTRIBUTION_PRESETS})


@staff_bp.get("/staff/dashboard")
@roles_required(*STAFF)
def dashboard():
    def count(sql, params=()):
        return query_one(sql, params)["n"]

    return jsonify(
        {
            "stats": {
                "totalStudents": count("SELECT COUNT(*) n FROM users WHERE role = 'STUDENT'"),
                "activeStudents": count("SELECT COUNT(*) n FROM users WHERE role='STUDENT' AND active=1"),
                "inProgress": count("SELECT COUNT(*) n FROM attempts WHERE status='IN_PROGRESS'"),
                "submitted": count(
                    "SELECT COUNT(*) n FROM attempts WHERE status IN"
                    " ('SUBMITTED','FORCE_SUBMITTED','TIME_EXPIRED')"
                ),
                "locked": count("SELECT COUNT(*) n FROM attempts WHERE status='LOCKED'"),
                "disconnected": count("SELECT COUNT(*) n FROM attempts WHERE status='DISCONNECTED'"),
                "editRequests": count("SELECT COUNT(*) n FROM edit_requests WHERE status='PENDING'"),
                "totalTests": count("SELECT COUNT(*) n FROM tests"),
                "activeTests": count("SELECT COUNT(*) n FROM tests WHERE status='ACTIVE'"),
            },
            "activity": [dict(r) for r in query(
                "SELECT id, actor, role, action, target, metadata, created_at AS createdAt"
                " FROM audit_logs ORDER BY id DESC LIMIT 8"
            )],
            "securityEvents": [dict(r) for r in query(
                "SELECT id, type, actor, role, detail, created_at AS createdAt"
                " FROM security_events ORDER BY id DESC LIMIT 6"
            )],
            "serverTime": utc_now(),
        }
    )


# ---------------------------------------------------------------- tests
@staff_bp.get("/staff/tests")
@roles_required(*STAFF)
def list_tests():
    return jsonify({"tests": [test_to_json(r) for r in query("SELECT * FROM tests ORDER BY created_at DESC")]})


@staff_bp.post("/staff/tests")
@roles_required(*STAFF)
def create_test():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"message": "Test name is required."}), 400
    if len(name) > 200:
        return jsonify({"message": "Test name is too long."}), 400
    try:
        question_count = safe_int(body.get("questionCount"), "Question count", minimum=1)
        duration = safe_int(body.get("durationMinutes"), "Duration", default=60, minimum=1, maximum=600)
        test_type = body.get("type", "MIXED")
        selection_mode = body.get("selectionMode", "RANDOM")
        if test_type not in TEST_TYPES:
            return jsonify({"message": "Unknown test type."}), 400
        if selection_mode not in SELECTION_MODES:
            return jsonify({"message": "Unknown selection mode."}), 400
        distribution = body.get("distribution") or {}
        if selection_mode == "DISTRIBUTION" and distribution_total(distribution) != question_count:
            return jsonify({"message": "The question distribution must add up to the total question count."}), 400
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    event_id = body.get("eventId")
    if not event_id:
        event = query_one("SELECT id FROM events ORDER BY start_date LIMIT 1")
        event_id = event["id"] if event else None
    if not event_id or not query_one("SELECT 1 FROM events WHERE id = ?", (event_id,)):
        return jsonify({"message": "No valid event is configured. Create one first."}), 400

    test_id = f"T{uuid.uuid4().hex[:8].upper()}"
    execute(
        "INSERT INTO tests (id, event_id, name, description, type, question_count, duration_minutes,"
        " selection_mode, distribution, manual_question_ids, scheduled_start, status,"
        " results_published, created_by, created_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)",
        (
            test_id,
            event_id,
            name,
            body.get("description", "")[:2000],
            test_type,
            question_count,
            duration,
            selection_mode,
            json.dumps(distribution),
            json.dumps(body.get("manualQuestionIds") or []),
            body.get("scheduledStart"),
            "SCHEDULED" if body.get("scheduledStart") else "DRAFT",
            g.user["id"],
            utc_now(),
        ),
    )
    audit(g.user["id"], g.user["role"], "Created test", name,
          f"{question_count} questions · {duration} min")
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (test_id,)))})


@staff_bp.get("/staff/tests/<test_id>")
@roles_required(*STAFF)
def get_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    return jsonify({"test": test_to_json(row)})


@staff_bp.put("/staff/tests/<test_id>")
@roles_required(*STAFF)
def update_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    body = request.get_json(silent=True) or {}
    try:
        question_count = safe_int(
            body.get("questionCount") if body.get("questionCount") is not None else row["question_count"],
            "Question count", default=row["question_count"], minimum=1,
        )
        new_duration = safe_int(
            body.get("durationMinutes") if body.get("durationMinutes") is not None else row["duration_minutes"],
            "Duration", default=row["duration_minutes"], minimum=1, maximum=600,
        )
        selection_mode = body.get("selectionMode") or row["selection_mode"]
        distribution = body.get("distribution") if body.get("distribution") is not None else loads(row["distribution"], {})
        if selection_mode == "DISTRIBUTION" and distribution_total(distribution) != question_count:
            return jsonify({"message": "The question distribution must add up to the total question count."}), 400
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    if row["status"] == "ACTIVE" and question_count != row["question_count"]:
        return jsonify({"message": "Question count cannot change while the test is live."}), 409

    if new_duration != row["duration_minutes"]:
        execute(
            "INSERT INTO timing_changes (test_id, old_duration, new_duration, staff_id, reason, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (test_id, row["duration_minutes"], new_duration, g.user["id"],
             (body.get("timingReason") or "Not specified")[:500], utc_now()),
        )
        audit(g.user["id"], g.user["role"], "Changed duration", row["name"],
              f"{row['duration_minutes']} → {new_duration} minutes")
        # Live attempts inherit the new server-side deadline, kept ISO-8601.
        for attempt in query(
            "SELECT id, started_at FROM attempts WHERE test_id = ? AND status IN ('IN_PROGRESS','LOCKED')",
            (test_id,),
        ):
            started = parse_utc(attempt["started_at"]) or datetime.now(timezone.utc)
            new_deadline = (started + timedelta(minutes=new_duration)).isoformat()
            execute(
                "UPDATE attempts SET deadline = ? WHERE id = ?", (new_deadline, attempt["id"])
            )

    execute(
        "UPDATE tests SET name = ?, description = ?, type = ?, question_count = ?,"
        " duration_minutes = ?, selection_mode = ?, distribution = ?, manual_question_ids = ?,"
        " scheduled_start = ? WHERE id = ?",
        (
            (body.get("name", row["name"]) or "")[:200],
            body.get("description", row["description"]),
            body.get("type", row["type"]),
            question_count,
            new_duration,
            selection_mode,
            json.dumps(distribution),
            json.dumps(body.get("manualQuestionIds") or loads(row["manual_question_ids"], [])),
            body.get("scheduledStart", row["scheduled_start"]),
            test_id,
        ),
    )
    audit(g.user["id"], g.user["role"], "Updated test", body.get("name", row["name"]))
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (test_id,)))})


@staff_bp.post("/staff/tests/<test_id>/duplicate")
@roles_required(*STAFF)
def duplicate_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    new_id = f"T{uuid.uuid4().hex[:8].upper()}"
    execute(
        "INSERT INTO tests (id, event_id, name, description, type, question_count, duration_minutes,"
        " selection_mode, distribution, manual_question_ids, scheduled_start, status,"
        " results_published, created_by, created_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,NULL,'DRAFT',0,?,?)",
        (
            new_id, row["event_id"], f"{row['name']} (Copy)", row["description"], row["type"],
            row["question_count"], row["duration_minutes"], row["selection_mode"],
            row["distribution"], row["manual_question_ids"], g.user["id"], utc_now(),
        ),
    )
    audit(g.user["id"], g.user["role"], "Duplicated test", f"{row['name']} (Copy)", f"from {row['name']}")
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (new_id,)))})


@staff_bp.get("/staff/tests/<test_id>/timing-changes")
@roles_required(*STAFF)
def test_timing_changes(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    changes = query(
        "SELECT * FROM timing_changes WHERE test_id = ? ORDER BY id DESC", (test_id,)
    )
    return jsonify({"changes": [timing_change_to_json(c) for c in changes]})


def transition(row, target):
    if target not in ALLOWED_TRANSITIONS[row["status"]]:
        return jsonify(
            {"message": f"A {row['status'].lower()} test cannot move to {target.lower()}."}
        ), 409
    execute("UPDATE tests SET status = ? WHERE id = ?", (target, row["id"]))
    return None


@staff_bp.post("/staff/tests/<test_id>/schedule")
@roles_required(*STAFF)
def schedule_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    if row["selection_mode"] == "DISTRIBUTION" and distribution_total(loads(row["distribution"], {})) != row["question_count"]:
        return jsonify({"message": "Fix the question distribution before scheduling this test."}), 400
    body = request.get_json(silent=True) or {}
    scheduled_start = body.get("scheduledStart", row["scheduled_start"])
    if not scheduled_start:
        return jsonify({"message": "Choose a scheduled start time before publishing this test."}), 400
    error = transition(row, "SCHEDULED")
    if error:
        return error
    execute("UPDATE tests SET scheduled_start = ? WHERE id = ?",
            (scheduled_start, test_id))
    audit(g.user["id"], g.user["role"], "Scheduled test", row["name"])
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (test_id,)))})


@staff_bp.post("/staff/tests/<test_id>/start")
@roles_required(*STAFF)
def start_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    if not row["scheduled_start"]:
        return jsonify({"message": "Set a scheduled start time before making this test live."}), 400
    scheduled_at = parse_utc(row["scheduled_start"])
    if scheduled_at is not None and scheduled_at > datetime.now(timezone.utc):
        return jsonify({"message": f"This test does not start until {row['scheduled_start']}."}), 409
    if row["status"] == "DRAFT":
        transition(row, "SCHEDULED")
        row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    error = transition(row, "ACTIVE")
    if error:
        return error
    execute("UPDATE tests SET started_at = ?, status = 'ACTIVE' WHERE id = ?", (utc_now(), test_id))
    audit(g.user["id"], g.user["role"], "Started test", row["name"])
    security_event("TEST_STARTED", g.user["id"], g.user["role"], f"{row['name']} opened", test_id=test_id)
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (test_id,)))})


@staff_bp.post("/staff/tests/<test_id>/stop")
@roles_required(*STAFF)
def stop_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    error = transition(row, "PAUSED")
    if error:
        return error
    audit(g.user["id"], g.user["role"], "Paused test", row["name"])
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (test_id,)))})


@staff_bp.post("/staff/tests/<test_id>/force-stop")
@roles_required(*STAFF)
def force_stop_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    if row["status"] not in ("ACTIVE", "PAUSED"):
        return jsonify({"message": "Only a live test can be force stopped."}), 409

    execute("UPDATE tests SET status = 'COMPLETED', stopped_at = ? WHERE id = ?", (utc_now(), test_id))
    active = query(
        "SELECT * FROM attempts WHERE test_id = ? AND status IN ('IN_PROGRESS','LOCKED')", (test_id,)
    )
    for attempt in active:
        stored = {
            r["question_id"]: r["value"] or ""
            for r in query("SELECT * FROM answers WHERE attempt_id = ?", (attempt["id"],))
        }
        finalize_attempt(attempt, stored, "FORCE_SUBMITTED")
    audit(g.user["id"], g.user["role"], "Force stopped test", row["name"], f"{len(active)} attempts finalised")
    security_event("TEST_FORCE_STOPPED", g.user["id"], g.user["role"], row["name"], test_id=test_id)
    return jsonify({"finalised": len(active)})


@staff_bp.delete("/staff/tests/<test_id>")
@roles_required(*STAFF)
def archive_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    if row["status"] not in ("DRAFT", "SCHEDULED"):
        return jsonify(
            {"message": "Only a draft or scheduled test can be removed. Force-stop live tests instead."}, 409
        )
    # Never hard-delete: historical results and attempts must keep their referents.
    execute("UPDATE tests SET status = 'ARCHIVED' WHERE id = ?", (test_id,))
    audit(g.user["id"], g.user["role"], "Archived test", row["name"])
    return jsonify({"ok": True})


# ---------------------------------------------------------------- questions
@staff_bp.get("/questions")
@roles_required(*STAFF)
def list_questions():
    sql = "SELECT * FROM questions WHERE 1 = 1"
    params = []
    for field, column in (("type", "type"), ("topic", "topic"), ("difficulty", "difficulty"), ("status", "status")):
        value = request.args.get(field)
        if value:
            sql += f" AND {column} = ?"
            params.append(value)
    search = request.args.get("search")
    if search:
        sql += " AND (LOWER(title) LIKE ? OR LOWER(id) LIKE ?)"
        params.extend([f"%{search.lower()}%", f"%{search.lower()}%"])
    rows = query(sql + " ORDER BY id", tuple(params))
    topics = [r["topic"] for r in query("SELECT DISTINCT topic FROM questions ORDER BY topic")]
    return jsonify({"questions": [question_to_json(r) for r in rows], "topics": topics, "total": len(rows)})


@staff_bp.post("/questions")
@roles_required(*STAFF)
def create_question():
    body = request.get_json(silent=True) or {}
    if not (body.get("title") or "").strip():
        return jsonify({"message": "Question title is required."}), 400
    if not (body.get("prompt") or "").strip():
        return jsonify({"message": "Question text is required."}), 400
    qtype = body.get("type", "MCQ")
    if qtype not in QUESTION_TYPES:
        return jsonify({"message": "Unknown question type."}), 400
    difficulty = body.get("difficulty") or "EASY"
    if difficulty not in DIFFICULTIES:
        return jsonify({"message": "Unknown difficulty."}), 400
    status = body.get("status") or "ACTIVE"
    if status not in STATUSES:
        return jsonify({"message": "Unknown status."}), 400
    try:
        marks = safe_int(body.get("marks"), "Marks", default=1, minimum=1, maximum=100)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    question_id = f"Q{uuid.uuid4().hex[:6].upper()}"
    execute(
        "INSERT INTO questions (id, version, title, type, topic, difficulty, marks, status, prompt,"
        " code, options, answer, alternatives, explanation, input_format, output_format, constraints,"
        " sample_input, sample_output, test_cases, created_by, created_at)"
        " VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            question_id, body["title"][:500], qtype, body.get("topic", "General")[:100],
            difficulty, marks, status,
            body["prompt"], body.get("code"), json.dumps(body.get("options")) if body.get("options") else None,
            body.get("answer", ""), json.dumps(body.get("alternatives") or []), body.get("explanation"),
            body.get("inputFormat"), body.get("outputFormat"), body.get("constraints"),
            body.get("sampleInput"), body.get("sampleOutput"), json.dumps(body.get("testCases") or []),
            g.user["id"], utc_now(),
        ),
    )
    audit(g.user["id"], g.user["role"], "Created question", question_id, body["title"])
    return jsonify({"question": question_to_json(query_one("SELECT * FROM questions WHERE id = ?", (question_id,)))})


@staff_bp.get("/questions/<question_id>")
@roles_required(*STAFF)
def single_question(question_id):
    row = query_one("SELECT * FROM questions WHERE id = ?", (question_id,))
    if row is None:
        return jsonify({"message": "Question not found."}), 404
    versions = query(
        "SELECT * FROM question_versions WHERE question_id = ? ORDER BY id DESC",
        (question_id,),
    )
    return jsonify(
        {
            "question": question_to_json(row),
            "versions": [version_to_json(v) for v in versions],
        }
    )


@staff_bp.put("/questions/<question_id>")
@roles_required(*STAFF)
def update_question(question_id):
    row = query_one("SELECT * FROM questions WHERE id = ?", (question_id,))
    if row is None:
        return jsonify({"message": "Question not found."}), 404
    body = request.get_json(silent=True) or {}
    try:
        marks = safe_int(
            body.get("marks") if body.get("marks") is not None else row["marks"],
            "Marks", default=row["marks"], minimum=1, maximum=100,
        )
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    qtype = body.get("type", row["type"])
    if qtype not in QUESTION_TYPES:
        return jsonify({"message": "Unknown question type."}), 400
    if body.get("status") not in STATUSES and body.get("status") is not None:
        return jsonify({"message": "Unknown status."}), 400

    in_use = query_one(
        "SELECT 1 FROM attempts WHERE question_ids LIKE ?", (f'%"{question_id}"%',)
    )
    version = row["version"]
    if in_use:
        # Preserve historical exam data: snapshot the old version instead of overwriting.
        execute(
            "INSERT INTO question_versions (question_id, version, snapshot, changed_by, reason, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (question_id, version, json.dumps(question_to_json(row)), g.user["id"],
             (body.get("reason") or "Correction during live test")[:500], utc_now()),
        )
        version += 1

    execute(
        "UPDATE questions SET version = ?, title = ?, type = ?, topic = ?, difficulty = ?, marks = ?,"
        " status = ?, prompt = ?, code = ?, options = ?, answer = ?, alternatives = ?, explanation = ?"
        " WHERE id = ?",
        (
            version, (body.get("title", row["title"]) or "")[:500], qtype,
            (body.get("topic", row["topic"]) or "")[:100],
            body.get("difficulty", row["difficulty"]), marks, body.get("status", row["status"]),
            body.get("prompt", row["prompt"]), body.get("code", row["code"]),
            json.dumps(body["options"]) if body.get("options") is not None else row["options"],
            (body.get("answer", row["answer"]) or ""),
            json.dumps(body["alternatives"]) if body.get("alternatives") is not None else row["alternatives"],
            body.get("explanation", row["explanation"]), question_id,
        ),
    )
    audit(g.user["id"], g.user["role"], "Updated question", question_id, f"v{version}")
    return jsonify({"question": question_to_json(query_one("SELECT * FROM questions WHERE id = ?", (question_id,)))})


@staff_bp.delete("/questions/<question_id>")
@roles_required(*STAFF)
def archive_question(question_id):
    row = query_one("SELECT * FROM questions WHERE id = ?", (question_id,))
    if row is None:
        return jsonify({"message": "Question not found."}), 404
    # Never hard-delete: historical attempts reference this row.
    execute("UPDATE questions SET status = 'ARCHIVED' WHERE id = ?", (question_id,))
    execute("DELETE FROM test_questions WHERE question_id = ?", (question_id,))
    audit(g.user["id"], g.user["role"], "Archived question", question_id, row["title"])
    return jsonify({"ok": True})


@staff_bp.post("/questions/<question_id>/duplicate")
@roles_required(*STAFF)
def duplicate_question(question_id):
    source = query_one("SELECT * FROM questions WHERE id = ?", (question_id,))
    if source is None:
        return jsonify({"message": "Question not found."}), 404
    copy_id = f"Q{uuid.uuid4().hex[:6].upper()}"
    execute(
        "INSERT INTO questions (id, version, title, type, topic, difficulty, marks, status, prompt,"
        " code, options, answer, alternatives, explanation, input_format, output_format, constraints,"
        " sample_input, sample_output, test_cases, created_by, created_at)"
        " VALUES (?,1,?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            copy_id, f"{source['title']} (Copy)", source["type"], source["topic"],
            source["difficulty"], source["marks"], source["prompt"], source["code"],
            source["options"], source["answer"], source["alternatives"], source["explanation"],
            source["input_format"], source["output_format"], source["constraints"],
            source["sample_input"], source["sample_output"], source["test_cases"],
            g.user["id"], utc_now(),
        ),
    )
    audit(g.user["id"], g.user["role"], "Duplicated question", copy_id, f"from {question_id}")
    return jsonify({"question": question_to_json(query_one("SELECT * FROM questions WHERE id = ?", (copy_id,)))})


# ------------------------------------------------- questions inside a test
_CSV_TYPE_MAP = {
    "MCQ": "MCQ",
    "TRUE_FALSE": "TRUE_FALSE",
    "FILL_BLANK": "FILL_BLANK",
    "OUTPUT_PREDICTION": "OUTPUT",
    "OUTPUT": "OUTPUT",
    "CODE_COMPLETION": "CODE_COMPLETION",
    "DEBUGGING": "DEBUGGING",
    "CODING": "CODING",
    "SHORT_ANSWER": "FILL_BLANK",
}


def insert_question_for_test(test_id: str, body: dict, user) -> str:
    question = str((body.get("question") or body.get("prompt") or "") or "").strip()
    if not question:
        raise ValueError("Question text is required.")
    qtype = body.get("type") or "MCQ"
    if qtype not in QUESTION_TYPES:
        raise ValueError(f"Unknown question type: {qtype}")
    difficulty = body.get("difficulty") or "EASY"
    if difficulty not in DIFFICULTIES:
        raise ValueError("Unknown difficulty.")
    try:
        marks = safe_int(body.get("marks"), "Marks", default=1, minimum=1, maximum=100)
    except ValueError:
        raise ValueError("Marks must be a whole number between 1 and 100.")

    question_id = f"Q{uuid.uuid4().hex[:6].upper()}"
    title = str(body.get("title") or question[:80])[:500]
    options = json.dumps(body["options"]) if body.get("options") else None
    execute(
        "INSERT INTO questions (id, version, title, type, topic, difficulty, marks, status, prompt,"
        " code, options, answer, alternatives, explanation, input_format, output_format, constraints,"
        " sample_input, sample_output, test_cases, created_by, created_at)"
        " VALUES (?,1,?,?,?,?,?,'ACTIVE',?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            question_id, title, qtype, str(body.get("topic") or "General")[:100],
            difficulty, marks,
            question, body.get("code") or None,
            options,
            str(body.get("answer") or body.get("correctAnswer") or ""),
            json.dumps(body.get("alternatives") if isinstance(body.get("alternatives"), list) else []),
            body.get("explanation") or None,
            body.get("inputFormat") or None, body.get("outputFormat") or None,
            body.get("constraints") or None, body.get("sampleInput") or None,
            body.get("sampleOutput") or None,
            json.dumps(body.get("testCases") if isinstance(body.get("testCases"), list) else []),
            user["id"], utc_now(),
        ),
    )
    row = query_one("SELECT COALESCE(MAX(position), 0) n FROM test_questions WHERE test_id = ?", (test_id,))
    position = (row["n"] or 0) + 1
    execute(
        "INSERT INTO test_questions (test_id, question_id, position) VALUES (?, ?, ?)",
        (test_id, question_id, position),
    )
    audit(user["id"], user["role"], "Created question", question_id, question)
    return question_id


def normalize_csv_row(raw: dict, line: int) -> dict:
    question = str(raw.get("question") or raw.get("prompt") or "").strip()
    if not question:
        raise ValueError(f'Row {line}: "question" is required.')
    qtype = _CSV_TYPE_MAP.get(str(raw.get("type") or "").strip().upper())
    if not qtype:
        raise ValueError(f'Row {line}: unknown question type "{raw.get("type")}".')
    try:
        marks = int(raw.get("marks") or 1)
    except (TypeError, ValueError):
        raise ValueError(f'Row {line}: "marks" must be a whole number.')
    if marks < 1:
        raise ValueError(f'Row {line}: "marks" must be a whole number.')
    difficulty = str(raw.get("difficulty") or "").upper()
    if difficulty not in DIFFICULTIES:
        difficulty = "EASY"
    options = [str(o) for o in (raw.get("option_a"), raw.get("option_b"), raw.get("option_c"), raw.get("option_d")) if str(o or "").strip() != ""]
    keywords = [k.strip() for k in str(raw.get("keywords") or "").split(",") if k.strip()]
    expected = str(raw.get("expected_output") or raw.get("answer") or raw.get("correctAnswer") or "").strip()
    correct = str(raw.get("correct_answer") or raw.get("correctAnswer") or "").strip()

    if qtype == "MCQ":
        if len(options) < 2:
            raise ValueError(f"Row {line}: MCQ questions need at least two options.")
        if len(correct) == 1 and correct.upper() in ("A", "B", "C", "D"):
            answer = str(ord(correct.upper()) - 65)
        elif correct:
            found = next((i for i, o in enumerate(options) if o.lower() == correct.lower()), None)
            answer = str(found) if found is not None else correct
        else:
            raise ValueError(f"Row {line}: MCQ questions need a correct answer (A–D or the option text).")
    elif qtype == "TRUE_FALSE":
        answer = "true" if str(raw.get("correct_answer") or raw.get("correctAnswer") or "").strip().lower() in ("true", "t", "yes", "1") else "false"
    else:
        answer = expected or correct
        if not answer:
            raise ValueError(f"Row {line}: a correct answer is required for {qtype} questions.")

    return {
        "question": question,
        "title": str(raw.get("title") or "").strip() or question[:80],
        "type": qtype,
        "marks": marks,
        "topic": str(raw.get("topic") or "").strip() or "General",
        "difficulty": difficulty,
        "options": options or None,
        "answer": answer,
        "alternatives": keywords,
        "explanation": str(raw.get("explanation") or "").strip() or None,
    }


@staff_bp.get("/staff/tests/<test_id>/questions")
@roles_required(*STAFF)
def test_questions(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    rows = query(
        "SELECT q.*, tq.position FROM test_questions tq JOIN questions q ON q.id = tq.question_id"
        " WHERE tq.test_id = ? ORDER BY tq.position",
        (test_id,),
    )
    return jsonify(
        {
            "questions": [question_to_json(r) for r in rows],
            "total": len(rows),
            "totalMarks": sum(r["marks"] for r in rows),
        }
    )


@staff_bp.post("/staff/tests/<test_id>/questions")
@roles_required(*STAFF)
def add_test_question(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    if row["status"] not in ("DRAFT", "SCHEDULED"):
        return jsonify({"message": "Questions can only be added while the test is not live."}), 409
    try:
        qid = insert_question_for_test(test_id, request.get_json(silent=True) or {}, g.user)
    except ValueError as error:
        return jsonify({"message": str(error)}), 400
    return jsonify({"question": question_to_json(query_one("SELECT * FROM questions WHERE id = ?", (qid,)))})


@staff_bp.post("/staff/tests/<test_id>/questions/import")
@roles_required(*STAFF)
def import_test_questions(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    if row["status"] not in ("DRAFT", "SCHEDULED"):
        return jsonify({"message": "Questions can only be added while the test is not live."}), 409
    rows = request.get_json(silent=True) or {}
    rows = rows.get("rows") if isinstance(rows, dict) else rows
    if not isinstance(rows, list) or not rows:
        return jsonify({"message": "No questions to import."}), 400
    imported = 0
    errors = []
    for i, raw in enumerate(rows):
        try:
            normalized = normalize_csv_row(raw if isinstance(raw, dict) else {}, i + 1)
            insert_question_for_test(test_id, normalized, g.user)
            imported += 1
        except ValueError as error:
            errors.append({"line": i + 1, "message": str(error)})
    audit(g.user["id"], g.user["role"], "Imported questions", row["name"], f"{imported} imported, {len(errors)} errors")
    fresh = query(
        "SELECT q.*, tq.position FROM test_questions tq JOIN questions q ON q.id = tq.question_id"
        " WHERE tq.test_id = ? ORDER BY tq.position",
        (test_id,),
    )
    return jsonify(
        {
            "imported": imported,
            "errors": errors,
            "total": len(fresh),
            "totalMarks": sum(r["marks"] for r in fresh),
            "questions": [question_to_json(r) for r in fresh],
        }
    )


@staff_bp.put("/staff/tests/<test_id>/questions")
@roles_required(*STAFF)
def reorder_test_questions(test_id):
    ordered_ids = (request.get_json(silent=True) or {}).get("orderedIds")
    if not isinstance(ordered_ids, list):
        return jsonify({"message": "An orderedIds array is required."}), 400
    owned = {r["question_id"] for r in query("SELECT question_id FROM test_questions WHERE test_id = ?", (test_id,))}
    for qid in ordered_ids:
        if str(qid) not in owned:
            return jsonify({"message": f"Question {qid} does not belong to this test."}), 400
    for i, qid in enumerate(ordered_ids):
        execute(
            "UPDATE test_questions SET position = ? WHERE test_id = ? AND question_id = ?",
            (i + 1, test_id, str(qid)),
        )
    audit(g.user["id"], g.user["role"], "Reordered questions", test_id)
    return jsonify({"ok": True})


# ---------------------------------------------------------------- monitoring
@staff_bp.get("/staff/live")
@roles_required(*STAFF)
def live():
    test_id = request.args.get("testId")
    if test_id:
        attempts = query("SELECT * FROM attempts WHERE test_id = ?", (test_id,))
    else:
        attempts = query("SELECT * FROM attempts")
    rows = []
    for attempt in attempts:
        answers = query("SELECT * FROM answers WHERE attempt_id = ?", (attempt["id"],))
        student = query_one("SELECT name FROM users WHERE id = ?", (attempt["student_id"],))
        test = query_one("SELECT name, status FROM tests WHERE id = ?", (attempt["test_id"],))
        events = query_one(
            "SELECT COUNT(*) n FROM security_events WHERE attempt_id = ?", (attempt["id"],)
        )
        rows.append(
            {
                "attemptId": attempt["id"],
                "studentId": attempt["student_id"],
                "name": student["name"] if student else attempt["student_id"],
                "testId": attempt["test_id"],
                "testName": test["name"] if test else attempt["test_id"],
                "status": attempt["status"],
                "currentQuestion": attempt["current_question"] + 1,
                "totalQuestions": len(loads(attempt["question_ids"], [])),
                "answered": len([a for a in answers if (a["value"] or "").strip()]),
                "locked": len([a for a in answers if a["locked"]]),
                "lastActivity": attempt["last_activity"],
                "securityEvents": events["n"],
            }
        )
    final_statuses = ("SUBMITTED", "FORCE_SUBMITTED", "TIME_EXPIRED")
    test = query_one("SELECT * FROM tests WHERE id = ?", (test_id,)) if test_id else None
    return jsonify(
        {
            "rows": rows,
            "test": test_to_json(test) if test else None,
            "stats": {
                "total": query_one("SELECT COUNT(*) n FROM users WHERE role='STUDENT'")["n"],
                "active": len([r for r in rows if r["status"] in active_statuses]),
                "submitted": len([r for r in rows if r["status"] in final_statuses]),
                "locked": len([r for r in rows if r["status"] == "LOCKED"]),
                "disconnected": len([r for r in rows if r["status"] == "DISCONNECTED"]),
                "securityEvents": query_one(
                    "SELECT COUNT(*) n FROM security_events"
                    + (" WHERE test_id = ?" if test_id else ""),
                    (test_id,) if test_id else (),
                )["n"],
                "pendingEdit": query_one(
                    "SELECT COUNT(*) n FROM edit_requests WHERE status='PENDING'"
                    + (" AND test_id = ?" if test_id else ""),
                    (test_id,) if test_id else (),
                )["n"],
                "activeTests": query_one(
                    "SELECT COUNT(*) n FROM tests WHERE status='ACTIVE'"
                    + (" AND id = ?" if test_id else ""),
                    (test_id,) if test_id else (),
                )["n"],
            },
            "serverTime": utc_now(),
        }
    )


@staff_bp.post("/staff/students/<student_id>/lock")
@roles_required(*STAFF)
def lock_student(student_id):
    attempt = query_one(
        "SELECT * FROM attempts WHERE student_id = ? AND status = 'IN_PROGRESS'", (student_id,)
    )
    if attempt is None:
        return jsonify({"message": "No live attempt found for this student."}), 404
    reason = (request.get_json(silent=True) or {}).get("reason", "Locked by examination staff")[:500]
    execute(
        "UPDATE attempts SET status='LOCKED', locked_by_staff=?, lock_reason=? WHERE id=?",
        (g.user["id"], reason, attempt["id"]),
    )
    audit(g.user["id"], g.user["role"], "Locked student", student_id, reason)
    security_event("STUDENT_LOCKED", g.user["id"], g.user["role"], student_id,
                   test_id=attempt["test_id"], attempt_id=attempt["id"])
    return jsonify({"ok": True})


@staff_bp.post("/staff/students/<student_id>/unlock")
@roles_required(*STAFF)
def unlock_student(student_id):
    attempt = query_one("SELECT * FROM attempts WHERE student_id = ? AND status = 'LOCKED'", (student_id,))
    if attempt is None:
        return jsonify({"message": "This student is not locked."}), 404
    execute(
        "UPDATE attempts SET status='IN_PROGRESS', locked_by_staff=NULL, lock_reason=NULL WHERE id=?",
        (attempt["id"],),
    )
    audit(g.user["id"], g.user["role"], "Unlocked student", student_id)
    security_event("STUDENT_UNLOCKED", g.user["id"], g.user["role"], student_id,
                   test_id=attempt["test_id"], attempt_id=attempt["id"])
    return jsonify({"ok": True})


@staff_bp.post("/staff/students/<student_id>/force-submit")
@roles_required(*STAFF)
def force_submit_student(student_id):
    attempt = query_one(
        "SELECT * FROM attempts WHERE student_id = ? AND status IN ('IN_PROGRESS','LOCKED')",
        (student_id,),
    )
    if attempt is None:
        return jsonify({"message": "No live attempt found for this student."}), 404
    stored = {
        r["question_id"]: r["value"] or ""
        for r in query("SELECT * FROM answers WHERE attempt_id = ?", (attempt["id"],))
    }
    result = finalize_attempt(attempt, stored, "FORCE_SUBMITTED")
    audit(g.user["id"], g.user["role"], "Force submitted student", student_id,
          f"score {result['score']}/{result['maxScore']}")
    return jsonify({"ok": True, "result": result})


# ---------------------------------------------------------------- roster
@staff_bp.get("/staff/students")
@roles_required(*STAFF)
def staff_students():
    sql = "SELECT * FROM users WHERE role = 'STUDENT'"
    params = []
    search = request.args.get("search")
    if search:
        sql += " AND (LOWER(id) LIKE ? OR LOWER(name) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term])
    students = []
    for r in query(sql + " ORDER BY id", tuple(params)):
        latest = query_one(
            "SELECT a.*, t.name AS test_name FROM attempts a JOIN tests t ON t.id = a.test_id"
            " WHERE a.student_id = ? ORDER BY COALESCE(a.started_at, a.last_activity) DESC LIMIT 1",
            (r["id"],),
        )
        taken = query_one(
            "SELECT COUNT(DISTINCT test_id) n FROM attempts WHERE student_id = ?", (r["id"],)
        )["n"]
        students.append(
            {
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "active": bool(r["active"]),
                "takenTests": taken,
                "currentStatus": latest["status"] if latest else "NOT_STARTED",
                "currentTest": latest["test_name"] if latest else None,
                "lastActivity": latest["last_activity"] if latest else None,
            }
        )
    return jsonify(
        {
            "total": len(students),
            "activeCount": len([s for s in students if s["active"]]),
            "students": students,
        }
    )


# ---------------------------------------------------------------- edit requests
@staff_bp.get("/staff/edit-requests")
@roles_required(*STAFF)
def edit_requests():
    rows = query(
        "SELECT e.*, u.name AS student_name, t.name AS test_name, q.title AS question_title"
        " FROM edit_requests e"
        " JOIN users u ON u.id = e.student_id"
        " JOIN tests t ON t.id = e.test_id"
        " JOIN questions q ON q.id = e.question_id"
        " ORDER BY e.created_at DESC"
    )
    return jsonify(
        {
            "requests": [
                {
                    "id": r["id"], "attemptId": r["attempt_id"], "studentId": r["student_id"],
                    "studentName": r["student_name"], "testId": r["test_id"], "testName": r["test_name"],
                    "questionId": r["question_id"], "questionTitle": r["question_title"],
                    "currentAnswer": r["current_answer"], "reason": r["reason"], "status": r["status"],
                    "decidedBy": r["decided_by"], "decidedAt": r["decided_at"], "createdAt": r["created_at"],
                }
                for r in rows
            ]
        }
    )


def decide_request(request_id, approve):
    row = query_one("SELECT * FROM edit_requests WHERE id = ?", (request_id,))
    if row is None:
        return jsonify({"message": "Request not found."}), 404
    if row["status"] != "PENDING":
        return jsonify({"message": "This request has already been decided."}), 409
    if approve:
        execute(
            "UPDATE answers SET edit_granted = 1 WHERE attempt_id = ? AND question_id = ?",
            (row["attempt_id"], row["question_id"]),
        )
    execute(
        "UPDATE edit_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?",
        ("APPROVED" if approve else "DENIED", g.user["id"], utc_now(), request_id),
    )
    action = "Approved modification" if approve else "Denied modification"
    audit(g.user["id"], g.user["role"], action, row["student_id"], row["question_id"])
    security_event(
        "MODIFICATION_APPROVED" if approve else "MODIFICATION_DENIED",
        g.user["id"], g.user["role"], f"{row['student_id']} · {row['question_id']}",
        test_id=row["test_id"], attempt_id=row["attempt_id"],
    )
    return jsonify({"ok": True})


@staff_bp.post("/staff/edit-requests/<request_id>/approve")
@roles_required(*STAFF)
def approve_request(request_id):
    return decide_request(request_id, True)


@staff_bp.post("/staff/edit-requests/<request_id>/deny")
@roles_required(*STAFF)
def deny_request(request_id):
    return decide_request(request_id, False)


# ---------------------------------------------------------------- results & logs
@staff_bp.get("/results")
@roles_required(*STAFF)
def results():
    sql = (
        "SELECT r.*, u.name AS student_name, t.name AS test_name, a.status AS attempt_status"
        " FROM results r JOIN users u ON u.id = r.student_id JOIN tests t ON t.id = r.test_id"
        " JOIN attempts a ON a.id = r.attempt_id WHERE 1 = 1"
    )
    params = []
    if request.args.get("testId"):
        sql += " AND r.test_id = ?"
        params.append(request.args["testId"])
    if request.args.get("status") == "PUBLISHED":
        sql += " AND r.published = 1"
    if request.args.get("status") == "HIDDEN":
        sql += " AND r.published = 0"
    if request.args.get("search"):
        sql += " AND (LOWER(r.student_id) LIKE ? OR LOWER(u.name) LIKE ?)"
        term = f"%{request.args['search'].lower()}%"
        params.extend([term, term])
    rows = query(sql + " ORDER BY r.submitted_at DESC", tuple(params))
    return jsonify(
        {
            "results": [
                {
                    "id": r["id"], "studentId": r["student_id"], "studentName": r["student_name"],
                    "testId": r["test_id"], "testName": r["test_name"],
                    "totalQuestions": r["total_questions"], "attempted": r["attempted"],
                    "correct": r["correct"], "wrong": r["wrong"], "unanswered": r["unanswered"],
                    "score": r["score"], "maxScore": r["max_score"], "percentage": r["percentage"],
                    "timeUsedSeconds": r["time_used_seconds"], "submittedAt": r["submitted_at"],
                    "published": bool(r["published"]), "attemptStatus": r["attempt_status"],
                }
                for r in rows
            ]
        }
    )


@staff_bp.get("/results/<result_id>")
@roles_required("STAFF", "SUPER_ADMIN", "STUDENT")
def single_result(result_id):
    row = query_one(
        "SELECT r.*, u.name AS student_name, t.name AS test_name, a.status AS attempt_status"
        " FROM results r JOIN users u ON u.id = r.student_id JOIN tests t ON t.id = r.test_id"
        " JOIN attempts a ON a.id = r.attempt_id WHERE r.id = ?",
        (result_id,),
    )
    if row is None:
        return jsonify({"message": "Result not found."}), 404
    if g.user["role"] == "STUDENT" and (row["student_id"] != g.user["id"] or not row["published"]):
        return jsonify({"message": "You do not have permission to view this result."}), 403
    return jsonify(
        {
            "result": {
                "id": row["id"], "studentId": row["student_id"], "studentName": row["student_name"],
                "testId": row["test_id"], "testName": row["test_name"],
                "totalQuestions": row["total_questions"], "attempted": row["attempted"],
                "correct": row["correct"], "wrong": row["wrong"], "unanswered": row["unanswered"],
                "score": row["score"], "maxScore": row["max_score"], "percentage": row["percentage"],
                "timeUsedSeconds": row["time_used_seconds"], "submittedAt": row["submitted_at"],
                "published": bool(row["published"]), "attemptStatus": row["attempt_status"],
            }
        }
    )
@staff_bp.post("/results/publish")
@roles_required(*STAFF)
def publish_results():
    body = request.get_json(silent=True) or {}
    test_id = body.get("testId")
    published = 1 if body.get("published") else 0
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
    execute("UPDATE tests SET results_published = ? WHERE id = ?", (published, test_id))
    execute("UPDATE results SET published = ? WHERE test_id = ?", (published, test_id))
    audit(g.user["id"], g.user["role"], "Published results" if published else "Hid results", row["name"])
    return jsonify({"ok": True})


@staff_bp.get("/staff/security-events")
@roles_required(*STAFF)
def security_events():
    sql = "SELECT * FROM security_events WHERE 1 = 1"
    params = []
    if request.args.get("type"):
        sql += " AND type = ?"
        params.append(request.args["type"])
    if request.args.get("search"):
        sql += " AND (LOWER(actor) LIKE ? OR LOWER(detail) LIKE ?)"
        term = f"%{request.args['search'].lower()}%"
        params.extend([term, term])
    rows = query(sql + " ORDER BY id DESC LIMIT 500", tuple(params))
    types = [r["type"] for r in query("SELECT DISTINCT type FROM security_events ORDER BY type")]
    return jsonify(
        {
            "events": [
                {"id": r["id"], "type": r["type"], "actor": r["actor"], "role": r["role"],
                 "detail": r["detail"], "createdAt": r["created_at"]}
                for r in rows
            ],
            "types": types,
        }
    )


@staff_bp.get("/staff/audit-logs")
@roles_required(*STAFF)
def audit_logs():
    sql = "SELECT * FROM audit_logs WHERE 1 = 1"
    params = []
    if request.args.get("search"):
        sql += " AND (LOWER(actor) LIKE ? OR LOWER(action) LIKE ? OR LOWER(target) LIKE ?)"
        term = f"%{request.args['search'].lower()}%"
        params.extend([term, term])
    rows = query(sql + " ORDER BY id DESC LIMIT 500", tuple(params))
    return jsonify(
        {
            "logs": [
                {"id": r["id"], "actor": r["actor"], "role": r["role"], "action": r["action"],
                 "target": r["target"], "metadata": r["metadata"], "createdAt": r["created_at"]}
                for r in rows
            ]
        }
    )


# ---------------------------------------------------------------- reports
@staff_bp.get("/staff/reports/analytics")
@roles_required(*STAFF)
def analytics_report():
    test_id = request.args.get("testId")
    if not test_id:
        return jsonify({"message": "A testId is required."}), 400
    if query_one("SELECT 1 FROM tests WHERE id = ?", (test_id,)) is None:
        return jsonify({"message": "Test not found."}), 404
    audit(g.user["id"], g.user["role"], "Viewed analytics", test_id)
    return jsonify(
        {
            "summary": test_summary(test_id),
            "perQuestion": question_level_analytics(test_id),
        }
    )


@staff_bp.get("/staff/reports/proctor")
@roles_required(*STAFF)
def proctor_report():
    test_id = request.args.get("testId")
    if not test_id:
        return jsonify({"message": "A testId is required."}), 400
    if query_one("SELECT 1 FROM tests WHERE id = ?", (test_id,)) is None:
        return jsonify({"message": "Test not found."}), 404
    return jsonify(
        {
            "risk": risk_by_student(test_id),
            "flags": evaluate_generic_flags(),
        }
    )


@staff_bp.get("/staff/reports/results.csv")
@roles_required(*STAFF)
def results_csv_download():
    test_id = request.args.get("testId")
    if not test_id:
        return jsonify({"message": "A testId is required."}), 400
    if query_one("SELECT 1 FROM tests WHERE id = ?", (test_id,)) is None:
        return jsonify({"message": "Test not found."}), 404
    test = query_one("SELECT name FROM tests WHERE id = ?", (test_id,))
    audit(g.user["id"], g.user["role"], "Exported results CSV", test["name"])
    return Response(
        build_results_csv(test_id),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="results-{test_id}.csv"'},
    )


@staff_bp.get("/staff/audit-logs.csv")
@roles_required(*STAFF)
def audit_logs_csv_download():
    return Response(
        audit_logs_csv(request.args.get("search") or ""),
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit-logs.csv"'},
    )


@staff_bp.get("/staff/security-events.csv")
@roles_required(*STAFF)
def security_events_csv_download():
    return Response(
        security_events_csv(request.args.get("testId") or ""),
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="security-events.csv"'},
    )