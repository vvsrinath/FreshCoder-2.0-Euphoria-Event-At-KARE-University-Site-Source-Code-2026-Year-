import json
import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request

from auth import roles_required
from database import audit, execute, loads, query, query_one, security_event, utc_now
from routes.student_routes import finalize_attempt

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
    error = transition(row, "SCHEDULED")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    execute("UPDATE tests SET scheduled_start = ? WHERE id = ?",
            (body.get("scheduledStart", row["scheduled_start"]), test_id))
    audit(g.user["id"], g.user["role"], "Scheduled test", row["name"])
    return jsonify({"test": test_to_json(query_one("SELECT * FROM tests WHERE id = ?", (test_id,)))})


@staff_bp.post("/staff/tests/<test_id>/start")
@roles_required(*STAFF)
def start_test(test_id):
    row = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if row is None:
        return jsonify({"message": "Test not found."}), 404
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
    if body.get("difficulty") not in DIFFICULTIES:
        return jsonify({"message": "Unknown difficulty."}), 400
    if body.get("status") not in STATUSES:
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
            body.get("difficulty", "EASY"), marks, body.get("status", "ACTIVE"),
            body["prompt"], body.get("code"), json.dumps(body.get("options")) if body.get("options") else None,
            body.get("answer", ""), json.dumps(body.get("alternatives") or []), body.get("explanation"),
            body.get("inputFormat"), body.get("outputFormat"), body.get("constraints"),
            body.get("sampleInput"), body.get("sampleOutput"), json.dumps(body.get("testCases") or []),
            g.user["id"], utc_now(),
        ),
    )
    audit(g.user["id"], g.user["role"], "Created question", question_id, body["title"])
    return jsonify({"question": question_to_json(query_one("SELECT * FROM questions WHERE id = ?", (question_id,)))})


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
    audit(g.user["id"], g.user["role"], "Archived question", question_id, row["title"])
    return jsonify({"ok": True})


# ---------------------------------------------------------------- monitoring
@staff_bp.get("/staff/live")
@roles_required(*STAFF)
def live():
    rows = []
    for attempt in query("SELECT * FROM attempts"):
        answers = query("SELECT * FROM answers WHERE attempt_id = ?", (attempt["id"],))
        student = query_one("SELECT name FROM users WHERE id = ?", (attempt["student_id"],))
        test = query_one("SELECT name FROM tests WHERE id = ?", (attempt["test_id"],))
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
    return jsonify(
        {
            "rows": rows,
            "stats": {
                "total": query_one("SELECT COUNT(*) n FROM users WHERE role='STUDENT'")["n"],
                "active": len([r for r in rows if r["status"] == "IN_PROGRESS"]),
                "submitted": len([r for r in rows if r["status"] in ("SUBMITTED", "FORCE_SUBMITTED", "TIME_EXPIRED")]),
                "locked": len([r for r in rows if r["status"] == "LOCKED"]),
                "disconnected": len([r for r in rows if r["status"] == "DISCONNECTED"]),
                "securityEvents": query_one("SELECT COUNT(*) n FROM security_events")["n"],
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