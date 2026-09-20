import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request

from auth import roles_required
from database import execute, loads, query, query_one, security_event, utc_now
from grading import grade_answer

student_bp = Blueprint("student", __name__, url_prefix="/api/student")

FINAL_STATES = ("SUBMITTED", "FORCE_SUBMITTED", "TIME_EXPIRED")
ACTIVE_STATES = ("IN_PROGRESS", "LOCKED")


# ---------------------------------------------------------------- helpers
def parse_utc(value: str):
    """Parse server timestamps robustly (space- or T-separated, aware or naive UTC)."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def deadline_expired(attempt) -> bool:
    if not attempt:
        return False
    try:
        raw_deadline = attempt["deadline"] if "deadline" in attempt.keys() else None
    except (KeyError, IndexError, AttributeError):
        raw_deadline = None
    deadline = parse_utc(raw_deadline)
    return deadline is not None and deadline < datetime.now(timezone.utc)


def select_question_ids(test) -> list:
    """The server selects and shuffles the question set — never the browser."""
    active = query("SELECT id, type FROM questions WHERE status = 'ACTIVE'")
    mode = test["selection_mode"]
    picked = []

    if mode == "MANUAL":
        manual = loads(test["manual_question_ids"], [])
        available = {row["id"] for row in active}
        picked = [qid for qid in manual if qid in available]
    elif mode == "DISTRIBUTION":
        distribution = loads(test["distribution"], {})
        for qtype, count in distribution.items():
            try:
                wanted = max(0, int(count))
            except (TypeError, ValueError):
                wanted = 0
            pool = [row["id"] for row in active if row["type"] == qtype]
            random.shuffle(pool)
            picked.extend(pool[:wanted])
        if len(picked) < test["question_count"]:
            filler = [row["id"] for row in active if row["id"] not in picked]
            random.shuffle(filler)
            picked.extend(filler[: test["question_count"] - len(picked)])
    else:
        pool = [row["id"] for row in active]
        if test["type"] not in ("MIXED", "QUIZ"):
            typed = [row["id"] for row in active if row["type"] == test["type"]]
            pool = typed or pool
        random.shuffle(pool)
        picked = pool[: test["question_count"]]

    random.shuffle(picked)
    return picked[: test["question_count"]]


def sanitize_question(row) -> dict:
    """Never ship answers or explanations to a student."""
    return {
        "id": row["id"],
        "version": row["version"],
        "title": row["title"],
        "type": row["type"],
        "topic": row["topic"],
        "difficulty": row["difficulty"],
        "marks": row["marks"],
        "prompt": row["prompt"],
        "code": row["code"],
        "options": loads(row["options"], None),
        "inputFormat": row["input_format"],
        "outputFormat": row["output_format"],
        "constraints": row["constraints"],
        "sampleInput": row["sample_input"],
        "sampleOutput": row["sample_output"],
    }


def freeze_started_questions(attempt) -> None:
    """Snapshot each question exactly as it was when the attempt started.

    Grading and display then use the frozen snapshot, so a mid-test answer-key
    correction never re-grades attempts that were already in flight.
    """
    for question_id in loads(attempt["question_ids"], []):
        row = query_one("SELECT * FROM questions WHERE id = ?", (question_id,))
        if row is None:
            continue
        execute(
            "INSERT OR IGNORE INTO frozen_questions (attempt_id, question_id, version, snapshot)"
            " VALUES (?, ?, ?, ?)",
            (attempt["id"], question_id, row["version"], json.dumps(dict(row))),
        )


def frozen_question(attempt, question_id):
    """Return the question row frozen at attempt start, falling back to live."""
    row = query_one(
        "SELECT snapshot FROM frozen_questions WHERE attempt_id = ? AND question_id = ?",
        (attempt["id"], question_id),
    )
    if row:
        try:
            return json.loads(row["snapshot"])
        except ValueError:
            pass
    return query_one("SELECT * FROM questions WHERE id = ?", (question_id,))


def attempt_payload(attempt) -> dict:
    test = query_one("SELECT * FROM tests WHERE id = ?", (attempt["test_id"],))
    question_ids = loads(attempt["question_ids"], [])
    questions = []
    for qid in question_ids:
        row = frozen_question(attempt, qid)
        if row:
            questions.append(sanitize_question(row))
    answers = query("SELECT * FROM answers WHERE attempt_id = ?", (attempt["id"],))
    return {
        "attempt": {
            "id": attempt["id"],
            "testId": attempt["test_id"],
            "status": attempt["status"],
            "startedAt": attempt["started_at"],
            "deadline": attempt["deadline"],
            "currentQuestion": attempt["current_question"],
            "lockedByStaff": attempt["locked_by_staff"],
            "lockReason": attempt["lock_reason"],
        },
        "test": {
            "id": test["id"],
            "name": test["name"],
            "type": test["type"],
            "status": test["status"],
            "durationMinutes": test["duration_minutes"],
            "questionCount": len(question_ids),
        },
        "questions": questions,
        "answers": [
            {
                "questionId": a["question_id"],
                "value": a["value"] or "",
                "locked": bool(a["locked"]),
                "editGranted": bool(a["edit_granted"]),
            }
            for a in answers
        ],
        "serverTime": utc_now(),
    }


def stored_answers(attempt) -> dict:
    return {
        r["question_id"]: r["value"] or ""
        for r in query("SELECT * FROM answers WHERE attempt_id = ?", (attempt["id"],))
    }


def finalize_attempt(attempt, incoming: dict, reason: str) -> dict:
    """Grade and store the attempt. Called by submit, force submit and force stop."""
    test = query_one("SELECT * FROM tests WHERE id = ?", (attempt["test_id"],))
    question_ids = loads(attempt["question_ids"], [])

    for question_id in question_ids:
        value = incoming.get(question_id)
        if value is None or not isinstance(value, str):
            continue
        existing = query_one(
            "SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?",
            (attempt["id"], question_id),
        )
        if existing is None:
            execute(
                "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at)"
                " VALUES (?, ?, ?, 1, 0, ?)",
                (attempt["id"], question_id, value[:10000], utc_now()),
            )
        elif not existing["locked"] or existing["edit_granted"]:
            execute(
                "UPDATE answers SET value = ?, locked = 1, edit_granted = 0, updated_at = ?"
                " WHERE attempt_id = ? AND question_id = ?",
                (value[:10000], utc_now(), attempt["id"], question_id),
            )

    correct = wrong = unanswered = score = max_score = 0
    breakdown = []
    for question_id in question_ids:
        question = frozen_question(attempt, question_id)
        if question is None:
            continue
        max_score += question["marks"]
        record = query_one(
            "SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?",
            (attempt["id"], question_id),
        )
        given = (record["value"] if record else "") or ""
        if not given.strip():
            unanswered += 1
            breakdown.append(
                {
                    "questionId": question_id,
                    "type": question["type"],
                    "marks": question["marks"],
                    "awarded": 0,
                    "correct": False,
                    "given": "",
                }
            )
            continue
        is_correct, awarded = grade_answer(question, given)
        score += awarded
        if is_correct is True:
            correct += 1
        elif is_correct is False:
            wrong += 1
        else:
            # CODE-type questions: recorded as attempted but await manual review.
            wrong += 1
        breakdown.append(
            {
                "questionId": question_id,
                "type": question["type"],
                "marks": question["marks"],
                "awarded": awarded,
                "correct": is_correct,
                "given": given,
            }
        )

    submitted_at = utc_now()
    started = parse_utc(attempt["started_at"]) or datetime.now(timezone.utc)
    time_used = max(0, int((datetime.now(timezone.utc) - started).total_seconds()))
    status = {
        "FORCE_SUBMITTED": "FORCE_SUBMITTED",
        "TIME_EXPIRED": "TIME_EXPIRED",
    }.get(reason, "SUBMITTED")

    execute(
        "UPDATE attempts SET status = ?, submitted_at = ?, last_activity = ?, session_token = NULL"
        " WHERE id = ?",
        (status, submitted_at, submitted_at, attempt["id"]),
    )

    total = len(question_ids)
    attempted = total - unanswered
    percentage = round((score / max_score) * 100, 1) if max_score else 0.0
    result_id = f"RS{uuid.uuid4().hex[:10].upper()}"
    execute("DELETE FROM results WHERE attempt_id = ?", (attempt["id"],))
    execute(
        "INSERT INTO results (id, attempt_id, test_id, student_id, total_questions, attempted,"
        " correct, wrong, unanswered, score, max_score, percentage, time_used_seconds,"
        " submitted_at, published, breakdown)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            result_id,
            attempt["id"],
            attempt["test_id"],
            attempt["student_id"],
            total,
            attempted,
            correct,
            wrong,
            unanswered,
            score,
            max_score,
            percentage,
            time_used,
            submitted_at,
            1 if test["results_published"] else 0,
            json.dumps(breakdown),
        ),
    )
    security_event(
        "FORCE_SUBMITTED" if status == "FORCE_SUBMITTED" else "TEST_SUBMITTED",
        attempt["student_id"],
        "STUDENT",
        f"{test['name']} finalised ({status})",
        test_id=test["id"],
        attempt_id=attempt["id"],
    )
    return {
        "id": result_id,
        "score": score,
        "maxScore": max_score,
        "percentage": percentage,
        "published": bool(test["results_published"]),
    }


def is_assigned(test_id: str, student_id: str) -> bool:
    """Assignment gating: if rows exist for a test, only assigned students may take it."""
    assigned = query_one(
        "SELECT 1 FROM student_test_assignments WHERE test_id = ? AND student_id = ?",
        (test_id, student_id),
    )
    if assigned:
        return True
    any_assignment = query_one(
        "SELECT 1 FROM student_test_assignments WHERE test_id = ? LIMIT 1", (test_id,)
    )
    return not any_assignment


def assigned_tests(student_id: str) -> list:
    rows = query(
        "SELECT * FROM tests WHERE status IN ('SCHEDULED','ACTIVE','PAUSED','COMPLETED')"
        " ORDER BY scheduled_start IS NULL, scheduled_start"
    )
    out = []
    for test in rows:
        if test["status"] in ("ACTIVE", "PAUSED", "COMPLETED") and not is_assigned(
            test["id"], student_id
        ):
            continue
        attempt = query_one(
            "SELECT * FROM attempts WHERE test_id = ? AND student_id = ?", (test["id"], student_id)
        )
        result = query_one(
            "SELECT * FROM results WHERE test_id = ? AND student_id = ?", (test["id"], student_id)
        )
        out.append(
            {
                "id": test["id"],
                "name": test["name"],
                "description": test["description"],
                "type": test["type"],
                "eventId": test["event_id"],
                "questionCount": test["question_count"],
                "durationMinutes": test["duration_minutes"],
                "scheduledStart": test["scheduled_start"],
                "status": test["status"],
                "attemptStatus": attempt["status"] if attempt else "NOT_STARTED",
                "attemptId": attempt["id"] if attempt else None,
                "resultAvailable": bool(result and result["published"]),
            }
        )
    return out


def own_attempt_or_403(attempt_id: str):
    attempt = query_one("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
    if attempt is None:
        return None, (jsonify({"message": "Attempt not found."}), 404)
    if attempt["student_id"] != g.user["id"]:
        security_event(
            "UNAUTHORIZED_ACCESS", g.user["id"], g.user["role"], f"Tried to open {attempt_id}"
        )
        return None, (jsonify({"message": "You do not have permission to view this attempt."}), 403)
    return attempt, None


# ---------------------------------------------------------------- routes
@student_bp.get("/dashboard")
@roles_required("STUDENT")
def dashboard():
    results = query(
        "SELECT r.*, t.name AS test_name FROM results r JOIN tests t ON t.id = r.test_id"
        " WHERE r.student_id = ? AND r.published = 1",
        (g.user["id"],),
    )
    event = query_one("SELECT * FROM events ORDER BY start_date LIMIT 1")
    return jsonify(
        {
            "student": {"id": g.user["id"], "name": g.user["name"], "email": g.user["email"]},
            "event": dict(event) if event else None,
            "tests": assigned_tests(g.user["id"]),
            "results": [
                {
                    "id": r["id"],
                    "testId": r["test_id"],
                    "testName": r["test_name"],
                    "score": r["score"],
                    "maxScore": r["max_score"],
                    "percentage": r["percentage"],
                    "submittedAt": r["submitted_at"],
                }
                for r in results
            ],
            "serverTime": utc_now(),
        }
    )


@student_bp.get("/tests")
@roles_required("STUDENT")
def list_tests():
    return jsonify({"tests": assigned_tests(g.user["id"]), "serverTime": utc_now()})


@student_bp.get("/tests/<test_id>")
@roles_required("STUDENT")
def get_test(test_id):
    test = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if test is None:
        return jsonify({"message": "Test is not available."}), 404
    if test["status"] in ("ACTIVE", "PAUSED", "COMPLETED") and not is_assigned(
        test_id, g.user["id"]
    ):
        return jsonify({"message": "Test is not available."}), 404
    attempt = query_one(
        "SELECT * FROM attempts WHERE test_id = ? AND student_id = ?", (test_id, g.user["id"])
    )
    return jsonify(
        {
            "test": {
                "id": test["id"],
                "name": test["name"],
                "description": test["description"],
                "type": test["type"],
                "questionCount": test["question_count"],
                "durationMinutes": test["duration_minutes"],
                "scheduledStart": test["scheduled_start"],
                "status": test["status"],
                "startedAt": test["started_at"],
            },
            "attemptStatus": attempt["status"] if attempt else "NOT_STARTED",
            "attemptId": attempt["id"] if attempt else None,
            "serverTime": utc_now(),
        }
    )


@student_bp.post("/tests/<test_id>/start")
@roles_required("STUDENT")
def start_test(test_id):
    test = query_one("SELECT * FROM tests WHERE id = ?", (test_id,))
    if test is None:
        return jsonify({"message": "Test is not available."}), 404
    if test["status"] in ("COMPLETED", "ARCHIVED"):
        return jsonify({"message": "This test has already ended."}), 409
    if test["status"] != "ACTIVE":
        return jsonify({"message": "The test has not been started by examination staff yet."}), 409
    if not is_assigned(test_id, g.user["id"]):
        return jsonify({"message": "You are not enrolled in this test."}), 403
    scheduled = parse_utc(test["scheduled_start"])
    if scheduled and scheduled > datetime.now(timezone.utc):
        return jsonify({"message": "This test has not started yet."}), 409

    attempt = query_one(
        "SELECT * FROM attempts WHERE test_id = ? AND student_id = ?", (test_id, g.user["id"])
    )
    token = g.get("session_token")

    if attempt is None:
        started = datetime.now(timezone.utc)
        deadline = started + timedelta(minutes=test["duration_minutes"])
        attempt_id = f"AT{uuid.uuid4().hex[:10].upper()}"
        execute(
            "INSERT INTO attempts (id, test_id, student_id, status, question_ids, started_at,"
            " deadline, current_question, last_activity, session_token)"
            " VALUES (?, ?, ?, 'IN_PROGRESS', ?, ?, ?, 0, ?, ?)",
            (
                attempt_id,
                test_id,
                g.user["id"],
                json.dumps(select_question_ids(test)),
                started.isoformat(),
                deadline.isoformat(),
                utc_now(),
                token,
            ),
        )
        security_event(
            "TEST_STARTED", g.user["id"], "STUDENT", f"Started {test['name']}",
            test_id=test_id, attempt_id=attempt_id,
        )
        attempt = query_one("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
        freeze_started_questions(attempt)
    else:
        if attempt["status"] in FINAL_STATES:
            return jsonify({"message": "You have already submitted this test."}), 409
        if attempt["session_token"] and attempt["session_token"] != token:
            security_event(
                "MULTIPLE_SESSION_DETECTED", g.user["id"], "STUDENT",
                "Attempt resumed from a different session",
                test_id=test_id, attempt_id=attempt["id"],
            )
        execute(
            "UPDATE attempts SET session_token = ?, last_activity = ? WHERE id = ?",
            (token, utc_now(), attempt["id"]),
        )
        attempt = query_one("SELECT * FROM attempts WHERE id = ?", (attempt["id"],))

    return jsonify(attempt_payload(attempt))


@student_bp.get("/attempts/<attempt_id>")
@roles_required("STUDENT")
def get_attempt(attempt_id):
    attempt, error = own_attempt_or_403(attempt_id)
    if error:
        return error
    freeze_started_questions(attempt)
    return jsonify(attempt_payload(attempt))


@student_bp.post("/attempts/<attempt_id>/lock")
@roles_required("STUDENT")
def lock_answer(attempt_id):
    attempt, error = own_attempt_or_403(attempt_id)
    if error:
        return error
    if attempt["status"] in FINAL_STATES:
        return jsonify({"message": "This attempt is no longer editable."}), 409
    if attempt["status"] == "LOCKED":
        return jsonify({"message": "Your attempt is locked by staff."}), 409
    if deadline_expired(attempt):
        finalize_attempt(attempt, stored_answers(attempt), "TIME_EXPIRED")
        return jsonify({"message": "Your time has expired. The test was submitted automatically."}), 409

    payload = request.get_json(silent=True) or {}
    question_id = payload.get("questionId")
    value = payload.get("value")
    if not isinstance(value, str):
        return jsonify({"message": "Answers must be text."}), 400
    if len(value) > 10000:
        return jsonify({"message": "Answer is too long."}), 400
    if question_id not in loads(attempt["question_ids"], []):
        return jsonify({"message": "That question is not part of your attempt."}), 400

    existing = query_one(
        "SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?", (attempt_id, question_id)
    )
    if existing and existing["locked"] and not existing["edit_granted"]:
        return jsonify({"message": "This answer is locked. Request a modification to change it."}), 409

    if existing:
        execute(
            "UPDATE answers SET value = ?, locked = 1, edit_granted = 0, updated_at = ?"
            " WHERE attempt_id = ? AND question_id = ?",
            (value, utc_now(), attempt_id, question_id),
        )
    else:
        execute(
            "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at)"
            " VALUES (?, ?, ?, 1, 0, ?)",
            (attempt_id, question_id, value, utc_now()),
        )
    execute("UPDATE attempts SET last_activity = ? WHERE id = ?", (utc_now(), attempt_id))
    security_event(
        "ANSWER_LOCKED", g.user["id"], "STUDENT", f"Locked {question_id}",
        test_id=attempt["test_id"], attempt_id=attempt_id,
    )
    return jsonify({"ok": True, "questionId": question_id, "locked": True})


@student_bp.post("/attempts/<attempt_id>/heartbeat")
@roles_required("STUDENT")
def heartbeat(attempt_id):
    attempt, error = own_attempt_or_403(attempt_id)
    if error:
        return error

    if attempt["status"] in FINAL_STATES:
        return jsonify(_heartbeat_payload(attempt))

    if deadline_expired(attempt):
        finalize_attempt(attempt, stored_answers(attempt), "TIME_EXPIRED")
        attempt = query_one("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
        return jsonify(_heartbeat_payload(attempt, auto_submitted=True))

    payload = request.get_json(silent=True) or {}
    current = payload.get("currentQuestion")
    question_ids = loads(attempt["question_ids"], [])
    if isinstance(current, int) and not isinstance(current, bool):
        current = max(0, min(current, len(question_ids) - 1))
    else:
        current = attempt["current_question"]
    execute(
        "UPDATE attempts SET current_question = ?, last_activity = ? WHERE id = ?",
        (current, utc_now(), attempt_id),
    )
    attempt = query_one("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
    return jsonify(_heartbeat_payload(attempt))


def _heartbeat_payload(attempt, auto_submitted: bool = False) -> dict:
    test = query_one("SELECT * FROM tests WHERE id = ?", (attempt["test_id"],))
    grants = query(
        "SELECT question_id FROM answers WHERE attempt_id = ? AND edit_granted = 1",
        (attempt["id"],),
    )
    return {
        "status": attempt["status"],
        "testStatus": test["status"],
        "forceSubmit": test["status"] in ("COMPLETED", "PAUSED")
        or attempt["status"] in FINAL_STATES
        or deadline_expired(attempt),
        "autoSubmitted": auto_submitted,
        "locked": attempt["status"] == "LOCKED",
        "lockReason": attempt["lock_reason"],
        "editGrants": [row["question_id"] for row in grants],
        "deadline": attempt["deadline"],
        "serverTime": utc_now(),
    }


@student_bp.post("/attempts/<attempt_id>/submit")
@roles_required("STUDENT")
def submit(attempt_id):
    attempt, error = own_attempt_or_403(attempt_id)
    if error:
        return error
    if attempt["status"] in FINAL_STATES:
        return jsonify({"message": "This attempt has already been submitted."}), 409

    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers") or {}

    # Atomic claim so two concurrent submits cannot both grade the attempt.
    claimed = execute(
        "UPDATE attempts SET status = 'SUBMITTED', last_activity = ?"
        " WHERE id = ? AND status IN ('IN_PROGRESS','LOCKED')",
        (utc_now(), attempt_id),
    )
    if claimed.rowcount == 0:
        return jsonify({"message": "This attempt has already been submitted."}), 409
    attempt = query_one("SELECT * FROM attempts WHERE id = ?", (attempt_id,))

    test = query_one("SELECT * FROM tests WHERE id = ?", (attempt["test_id"],))

    # The server decides why the attempt ended. The browser clock is never trusted.
    expired = deadline_expired(attempt)
    if test["status"] in ("COMPLETED", "PAUSED"):
        reason = "FORCE_SUBMITTED"
    elif expired or payload.get("reason") == "TIME_EXPIRED":
        reason = "TIME_EXPIRED"
    else:
        reason = "NORMAL"

    result = finalize_attempt(attempt, answers, reason)
    return jsonify(
        {
            "submitted": True,
            "reason": reason,
            "resultPublished": result["published"],
            "summary": {
                "score": result["score"],
                "maxScore": result["maxScore"],
                "percentage": result["percentage"],
            }
            if result["published"]
            else None,
        }
    )


@student_bp.post("/attempts/<attempt_id>/edit-request")
@roles_required("STUDENT")
def edit_request(attempt_id):
    attempt, error = own_attempt_or_403(attempt_id)
    if error:
        return error
    if attempt["status"] in FINAL_STATES:
        return jsonify({"message": "This attempt is no longer editable."}), 409
    if attempt["status"] != "IN_PROGRESS":
        return jsonify({"message": "Your attempt is locked by staff."}), 409
    if deadline_expired(attempt):
        return jsonify({"message": "Your time has expired."}), 409
    payload = request.get_json(silent=True) or {}
    question_id = payload.get("questionId")
    answer_value = payload.get("value", "")

    # Save the answer to DB if not already there (answers are kept in browser
    # memory during the exam and only persisted to DB on edit request or submit).
    record = query_one(
        "SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?", (attempt_id, question_id)
    )
    if record is None and answer_value:
        execute(
            "INSERT INTO answers (attempt_id, question_id, value, locked, edit_granted, updated_at)"
            " VALUES (?, ?, ?, 1, 0, ?)",
            (attempt_id, question_id, answer_value[:10000], _utcnow()),
        )
        record = query_one(
            "SELECT * FROM answers WHERE attempt_id = ? AND question_id = ?", (attempt_id, question_id)
        )
    if record is None:
        return jsonify({"message": "No answer to request modification for."}), 400
    pending = query_one(
        "SELECT 1 FROM edit_requests WHERE attempt_id = ? AND question_id = ? AND status = 'PENDING'",
        (attempt_id, question_id),
    )
    if pending:
        return jsonify({"message": "A request for this question is already pending."}), 409

    request_id = f"ER{uuid.uuid4().hex[:8].upper()}"
    execute(
        "INSERT INTO edit_requests (id, attempt_id, student_id, test_id, question_id,"
        " current_answer, reason, status, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)",
        (
            request_id,
            attempt_id,
            g.user["id"],
            attempt["test_id"],
            question_id,
            record["value"],
            (payload.get("reason", "") or "")[:500],
            utc_now(),
        ),
    )
    security_event(
        "MODIFICATION_REQUEST", g.user["id"], "STUDENT", f"Requested edit for {question_id}",
        test_id=attempt["test_id"], attempt_id=attempt_id,
    )
    return jsonify({"request": {"id": request_id, "status": "PENDING"}})


@student_bp.post("/attempts/<attempt_id>/verify-pin")
@roles_required("STUDENT")
def verify_pin(attempt_id):
    attempt, error = own_attempt_or_403(attempt_id)
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    pin = (payload.get("pin") or "").strip()
    if not pin:
        return jsonify({"message": "Please enter staff PIN"}), 400
    from auth import verify_password
    staff_rows = query("SELECT password_hash FROM users WHERE role IN ('STAFF','SUPER_ADMIN','DEVELOPER') AND active = 1")
    valid = False
    for row in staff_rows:
        if verify_password(pin, row["password_hash"]):
            valid = True
            break
    if not valid:
        security_event("STAFF_PIN_FAILED", g.user["id"], g.user["role"], f"Invalid PIN for attempt {attempt_id}", test_id=attempt["test_id"], attempt_id=attempt_id)
        return jsonify({"message": "Invalid PIN. Access Denied."}), 403
    security_event("STAFF_PIN_SUCCESS", g.user["id"], g.user["role"], f"Staff unlocked attempt {attempt_id}", test_id=attempt["test_id"], attempt_id=attempt_id)
    return jsonify({"ok": True})


@student_bp.get("/results")
@roles_required("STUDENT")
def student_results():
    rows = query(
        "SELECT r.*, t.name AS test_name FROM results r JOIN tests t ON t.id = r.test_id"
        " WHERE r.student_id = ? AND r.published = 1 ORDER BY r.submitted_at DESC",
        (g.user["id"],),
    )
    return jsonify(
        {
            "results": [
                {
                    "id": r["id"],
                    "testName": r["test_name"],
                    "totalQuestions": r["total_questions"],
                    "attempted": r["attempted"],
                    "correct": r["correct"],
                    "wrong": r["wrong"],
                    "unanswered": r["unanswered"],
                    "score": r["score"],
                    "maxScore": r["max_score"],
                    "percentage": r["percentage"],
                    "timeUsedSeconds": r["time_used_seconds"],
                    "submittedAt": r["submitted_at"],
                }
                for r in rows
            ]
        }
    )