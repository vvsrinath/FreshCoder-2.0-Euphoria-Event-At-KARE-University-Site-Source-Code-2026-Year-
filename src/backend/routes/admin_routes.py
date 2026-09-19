import uuid
from datetime import datetime

from flask import Blueprint, g, jsonify, request

from auth import hash_password, revoke_user_sessions, roles_required
from database import audit, execute, query, query_one, utc_now

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

MIN_PASSWORD_LENGTH = 8
MAX_IMPORT_ROWS = 5000


def validate_password(password: str):
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
    return None


def user_to_json(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "active": bool(row["active"]),
        "createdAt": row["created_at"],
    }


def list_users(role):
    sql = "SELECT * FROM users WHERE role = ?"
    params = [role]
    status = request.args.get("status")
    if status == "ACTIVE":
        sql += " AND active = 1"
    elif status == "INACTIVE":
        sql += " AND active = 0"
    search = request.args.get("search")
    if search:
        sql += " AND (LOWER(id) LIKE ? OR LOWER(name) LIKE ?)"
        term = f"%{search.lower()}%"
        params.extend([term, term])
    return [user_to_json(r) for r in query(sql + " ORDER BY id", tuple(params))]


def create_account(role):
    body = request.get_json(silent=True) or {}
    user_id = (body.get("id") or "").strip().upper()
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""
    if not user_id or not name or not password:
        return None, (jsonify({"message": "ID, name and password are required."}), 400)
    if len(user_id) > 60 or len(name) > 200:
        return None, (jsonify({"message": "ID or name is too long."}), 400)
    error = validate_password(password)
    if error:
        return None, (jsonify({"message": error}), 400)
    if query_one("SELECT 1 FROM users WHERE UPPER(id) = ?", (user_id,)):
        return None, (jsonify({"message": f"{user_id} already exists."}), 409)
    execute(
        "INSERT INTO users (id, role, name, email, password_hash, active, created_at)"
        " VALUES (?, ?, ?, ?, ?, 1, ?)",
        (user_id, role, name, (body.get("email") or "").strip()[:200], hash_password(password), utc_now()),
    )
    audit(g.user["id"], g.user["role"],
          "Created student" if role == "STUDENT" else "Created staff", user_id, name)
    return query_one("SELECT * FROM users WHERE id = ?", (user_id,)), None


def update_account(user_id, role):
    row = query_one("SELECT * FROM users WHERE id = ? AND role = ?", (user_id, role))
    if row is None:
        return None, (jsonify({"message": "Account not found."}), 404)
    body = request.get_json(silent=True) or {}
    if body.get("password"):
        error = validate_password(body["password"])
        if error:
            return None, (jsonify({"message": error}), 400)
        execute("UPDATE users SET password_hash = ? WHERE id = ?",
                (hash_password(body["password"]), user_id))
        # Old tokens stop working immediately after a password reset.
        revoke_user_sessions(user_id)
        audit(g.user["id"], g.user["role"], "Reset password", user_id)
    if "active" in body:
        execute("UPDATE users SET active = ? WHERE id = ?", (1 if body["active"] else 0, user_id))
        audit(g.user["id"], g.user["role"],
              "Activated account" if body["active"] else "Deactivated account", user_id)
    if body.get("name") or body.get("email") is not None:
        execute(
            "UPDATE users SET name = ?, email = ? WHERE id = ?",
            ((body.get("name", row["name"]) or "")[:200], (body.get("email", row["email"]) or "")[:200], user_id),
        )
        audit(g.user["id"], g.user["role"], "Edited account", user_id)
    return query_one("SELECT * FROM users WHERE id = ?", (user_id,)), None


@admin_bp.get("/overview")
@roles_required("SUPER_ADMIN")
def overview():
    def count(sql):
        return query_one(sql)["n"]

    return jsonify(
        {
            "stats": {
                "students": count("SELECT COUNT(*) n FROM users WHERE role='STUDENT'"),
                "activeStudents": count("SELECT COUNT(*) n FROM users WHERE role='STUDENT' AND active=1"),
                "staff": count("SELECT COUNT(*) n FROM users WHERE role='STAFF'"),
                "events": count("SELECT COUNT(*) n FROM events"),
                "tests": count("SELECT COUNT(*) n FROM tests"),
                "questions": count("SELECT COUNT(*) n FROM questions WHERE status='ACTIVE'"),
                "results": count("SELECT COUNT(*) n FROM results"),
            },
            "recentAudit": [
                {"id": r["id"], "actor": r["actor"], "action": r["action"], "target": r["target"],
                 "metadata": r["metadata"], "createdAt": r["created_at"]}
                for r in query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8")
            ],
            "securityEvents": [
                {"id": r["id"], "type": r["type"], "actor": r["actor"], "createdAt": r["created_at"]}
                for r in query("SELECT * FROM security_events ORDER BY id DESC LIMIT 6")
            ],
        }
    )


@admin_bp.get("/students")
@roles_required("SUPER_ADMIN")
def students():
    return jsonify({"students": list_users("STUDENT")})


@admin_bp.post("/students")
@roles_required("SUPER_ADMIN")
def create_student():
    row, error = create_account("STUDENT")
    return error or jsonify({"student": user_to_json(row)})


@admin_bp.put("/students/<student_id>")
@roles_required("SUPER_ADMIN")
def update_student(student_id):
    row, error = update_account(student_id, "STUDENT")
    return error or jsonify({"student": user_to_json(row)})


@admin_bp.post("/students/import")
@roles_required("SUPER_ADMIN")
def import_students():
    rows = (request.get_json(silent=True) or {}).get("rows") or []
    if not rows:
        return jsonify({"message": "The uploaded file contains no rows."}), 400
    if len(rows) > MAX_IMPORT_ROWS:
        return jsonify({"message": f"Too many rows. Import at most {MAX_IMPORT_ROWS} at once."}), 400
    errors = []
    success = 0
    for index, row in enumerate(rows):
        student_id = (row.get("student_id") or "").strip().upper()
        name = (row.get("name") or "").strip()
        password = (row.get("password") or "").strip()
        if not student_id or not name or not password:
            errors.append({"row": index + 2, "message": "Missing student_id, name or password"})
            continue
        error = validate_password(password)
        if error:
            errors.append({"row": index + 2, "message": error})
            continue
        if query_one("SELECT 1 FROM users WHERE UPPER(id) = ?", (student_id,)):
            errors.append({"row": index + 2, "message": f"Duplicate ID {student_id}"})
            continue
        execute(
            "INSERT INTO users (id, role, name, email, password_hash, active, created_at)"
            " VALUES (?, 'STUDENT', ?, ?, ?, 1, ?)",
            (student_id, name, (row.get("email") or "").strip()[:200], hash_password(password), utc_now()),
        )
        success += 1
    audit(g.user["id"], g.user["role"], "Imported students", f"{len(rows)} rows",
          f"{success} imported, {len(errors)} failed")
    return jsonify({"total": len(rows), "success": success, "failed": len(errors), "errors": errors})


@admin_bp.get("/staff")
@roles_required("SUPER_ADMIN")
def staff_accounts():
    return jsonify({"staff": list_users("STAFF")})


@admin_bp.post("/staff")
@roles_required("SUPER_ADMIN")
def create_staff():
    row, error = create_account("STAFF")
    return error or jsonify({"staff": user_to_json(row)})


@admin_bp.put("/staff/<staff_id>")
@roles_required("SUPER_ADMIN")
def update_staff(staff_id):
    row, error = update_account(staff_id, "STAFF")
    return error or jsonify({"staff": user_to_json(row)})


@admin_bp.get("/events")
@roles_required("SUPER_ADMIN", "STAFF")
def events():
    rows = query("SELECT * FROM events ORDER BY start_date")
    out = []
    for r in rows:
        count = query_one("SELECT COUNT(*) n FROM tests WHERE event_id = ?", (r["id"],))["n"]
        out.append(
            {
                "id": r["id"], "name": r["name"], "description": r["description"],
                "department": r["department"], "startDate": r["start_date"], "endDate": r["end_date"],
                "venue": r["venue"], "status": r["status"], "registrationSite": r["registration_site"],
                "registrationFee": r["registration_fee"], "prizePool": r["prize_pool"],
                "testCount": count,
            }
        )
    return jsonify({"events": out})


def validate_event_dates(body):
    start = body.get("startDate") or ""
    end = body.get("endDate") or ""
    if start and end:
        try:
            start_dt = datetime.fromisoformat(start.replace(" ", "T"))
            end_dt = datetime.fromisoformat(end.replace(" ", "T"))
        except ValueError:
            return {"message": "Event dates must be valid ISO dates."}
        if end_dt < start_dt:
            return {"message": "The event end date cannot be before its start date."}
    return None


@admin_bp.post("/events")
@roles_required("SUPER_ADMIN")
def create_event():
    body = request.get_json(silent=True) or {}
    if not (body.get("name") or "").strip():
        return jsonify({"message": "Event name is required."}), 400
    error = validate_event_dates(body)
    if error:
        return jsonify(error), 400
    event_id = f"EV{uuid.uuid4().hex[:6].upper()}"
    execute(
        "INSERT INTO events (id, name, description, department, start_date, end_date, venue,"
        " status, registration_site, registration_fee, prize_pool)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (
            event_id, body["name"][:200], body.get("description", ""), body.get("department", ""),
            body.get("startDate", ""), body.get("endDate", ""), body.get("venue", ""),
            body.get("status", "DRAFT"), body.get("registrationSite", ""),
            body.get("registrationFee", ""), body.get("prizePool", ""),
        ),
    )
    audit(g.user["id"], g.user["role"], "Created event", body["name"])
    return jsonify({"event": {"id": event_id, **body}})


@admin_bp.put("/events/<event_id>")
@roles_required("SUPER_ADMIN")
def update_event(event_id):
    row = query_one("SELECT * FROM events WHERE id = ?", (event_id,))
    if row is None:
        return jsonify({"message": "Event not found."}), 404
    body = request.get_json(silent=True) or {}
    error = validate_event_dates(body)
    if error:
        return jsonify(error), 400
    execute(
        "UPDATE events SET name=?, description=?, department=?, start_date=?, end_date=?, venue=?,"
        " status=?, registration_site=?, registration_fee=?, prize_pool=? WHERE id=?",
        (
            body.get("name", row["name"]), body.get("description", row["description"]),
            body.get("department", row["department"]), body.get("startDate", row["start_date"]),
            body.get("endDate", row["end_date"]), body.get("venue", row["venue"]),
            body.get("status", row["status"]), body.get("registrationSite", row["registration_site"]),
            body.get("registrationFee", row["registration_fee"]),
            body.get("prizePool", row["prize_pool"]), event_id,
        ),
    )
    audit(g.user["id"], g.user["role"], "Updated event", event_id)
    return jsonify({"ok": True})