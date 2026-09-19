from collections import defaultdict
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request

from auth import (
    DUMMY_HASH,
    create_session,
    current_user,
    destroy_session,
    hash_password,
    login_required,
    revoke_user_sessions,
    verify_password,
)
from config import config
from database import audit, execute, query_one, security_event, utc_now

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
developer_bp = Blueprint("developer", __name__, url_prefix="/api/developer")

PORTAL_ROLES = {
    "STUDENT": ("STUDENT",),
    "STAFF": ("STAFF",),
    "ADMIN": ("SUPER_ADMIN", "DEVELOPER"),
}

MONITORING_EVENTS = {
    "FULLSCREEN_EXIT",
    "TAB_VISIBILITY_CHANGE",
    "NAVIGATION_ATTEMPT",
    "CONTEXT_MENU_BLOCKED",
    "COPY_BLOCKED",
}

MIN_PASSWORD_LENGTH = 8

# In-memory login throttle keyed by user + IP. Acceptable for a single-site
# event; upgrade to a shared store if the app ever runs multi-process.
_FAILURES: dict = defaultdict(list)


def _login_key(user_id: str) -> str:
    return f"{user_id}|{request.remote_addr or 'local'}"


def _check_throttled(user_id: str) -> bool:
    now = datetime.now(timezone.utc)
    key = _login_key(user_id)
    window = timedelta(minutes=config.LOGIN_WINDOW_MINUTES)
    _FAILURES[key] = [t for t in _FAILURES[key] if now - t < window]
    return len(_FAILURES[key]) >= config.LOGIN_MAX_ATTEMPTS


def _record_failure(user_id: str) -> None:
    _FAILURES[_login_key(user_id)].append(datetime.now(timezone.utc))


def _record_success(user_id: str) -> None:
    _FAILURES.pop(_login_key(user_id), None)


def public_user(row):
    return {
        "id": row["id"],
        "role": row["role"],
        "name": row["name"],
        "email": row["email"],
        "active": bool(row["active"]),
    }


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    user_id = (payload.get("userId") or "").strip().upper()
    password = payload.get("password") or ""
    portal = payload.get("portal") or ""

    if not user_id or not password:
        return jsonify({"message": "Enter your ID and password to continue."}), 400
    if _check_throttled(user_id):
        security_event(
            "LOGIN_THROTTLED", user_id, "SYSTEM",
            f"Login blocked {config.LOGIN_MAX_ATTEMPTS}+ failures in "
            f"{config.LOGIN_WINDOW_MINUTES} minutes",
        )
        return jsonify({"message": "Too many attempts. Try again later."}), 429

    user = query_one("SELECT * FROM users WHERE UPPER(id) = ?", (user_id,))
    # Always run the hash comparison so response time does not reveal whether
    # an ID is registered (defeats account enumeration).
    valid = user is not None and verify_password(password, user["password_hash"])
    if user is None:
        verify_password(password, DUMMY_HASH)

    if user is None or not valid:
        _record_failure(user_id)
        security_event("LOGIN_FAILURE", user_id, "SYSTEM", f"Failed login on {portal} portal")
        return jsonify({"message": "Invalid credentials. Please check your ID and password."}), 401
    if not user["active"]:
        _record_failure(user_id)
        return jsonify({"message": "This account has been deactivated."}), 403
    if portal and user["role"] not in PORTAL_ROLES.get(portal, ()):
        _record_failure(user_id)
        security_event("LOGIN_FAILURE", user["id"], user["role"], f"Wrong portal ({portal})")
        return jsonify({"message": "This account cannot sign in from this portal."}), 403

    existing = query_one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", (user["id"],))
    if existing and existing["n"] > 0:
        security_event(
            "LOGIN_BLOCKED",
            user["id"],
            user["role"],
            f"Already logged in — blocked sign-in from {portal} portal",
        )
        return jsonify({"message": "You are already signed in on another device. Please log out there first."}), 409

    _record_success(user_id)
    token = create_session(user["id"], user["role"])
    security_event("LOGIN_SUCCESS", user["id"], user["role"], f"Signed in via {portal}")
    security_event("SESSION_STARTED", user["id"], user["role"], "Session started")
    return jsonify({"token": token, "user": public_user(user)})


@auth_bp.post("/logout")
def logout():
    user = current_user()
    if user is not None:
        destroy_session(g.session_token)
        security_event("SESSION_ENDED", user["id"], user["role"], "Signed out")
    return jsonify({"ok": True})


@auth_bp.get("/me")
@login_required
def me():
    return jsonify({"user": public_user(g.user)})


@auth_bp.post("/security-event")
@login_required
def report_event():
    payload = request.get_json(silent=True) or {}
    event_type = payload.get("type")
    if event_type not in MONITORING_EVENTS:
        return jsonify({"message": "Unknown monitoring signal."}), 400
    detail = (payload.get("detail") or "")[:500]
    attempt_id = payload.get("attemptId")
    if attempt_id:
        # A student may only attach monitoring signals to their own attempt.
        attempt = query_one(
            "SELECT 1 FROM attempts WHERE id = ? AND student_id = ?",
            (attempt_id, g.user["id"]),
        )
        if g.user["role"] == "STUDENT" and attempt is None:
            return jsonify({"message": "Unknown attempt."}), 400
    security_event(
        event_type,
        g.user["id"],
        g.user["role"],
        detail,
        attempt_id=attempt_id,
    )
    return jsonify({"ok": True})


def _validate_password(password: str):
    if len(password) < MIN_PASSWORD_LENGTH:
        return {
            "message": f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        }
    return None


@developer_bp.post("/init-super-admin")
@login_required
def init_super_admin():
    """Developer bootstrap. Not exposed as a normal application feature."""
    if g.user["role"] != "DEVELOPER":
        return jsonify({"message": "Only the developer account can initialise a Super Admin."}), 403
    payload = request.get_json(silent=True) or {}
    user_id = (payload.get("id") or "").strip().upper()
    name = payload.get("name")
    password = payload.get("password") or ""
    if not user_id or not name or not password:
        return jsonify({"message": "ID, name and password are required."}), 400
    error = _validate_password(password)
    if error:
        return jsonify(error), 400
    if query_one("SELECT 1 FROM users WHERE id = ?", (user_id,)):
        return jsonify({"message": "That ID already exists."}), 409
    execute(
        "INSERT INTO users (id, role, name, email, password_hash, active, created_at)"
        " VALUES (?, 'SUPER_ADMIN', ?, ?, ?, 1, ?)",
        (user_id, name, payload.get("email", ""), hash_password(password), utc_now()),
    )
    audit(g.user["id"], g.user["role"], "Initialised Super Admin", user_id)
    return jsonify({"ok": True})