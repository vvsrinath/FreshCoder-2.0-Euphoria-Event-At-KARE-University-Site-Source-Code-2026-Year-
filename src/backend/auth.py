"""Authentication and authorization. Enforced on every protected endpoint."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from config import config
from database import execute, query_one, utc_now


def hash_password(raw: str) -> str:
    return generate_password_hash(raw, method="pbkdf2:sha256", salt_length=16)


def verify_password(raw: str, hashed: str) -> bool:
    return check_password_hash(hashed, raw)


# Fixed dummy hash used to equalize login timing for unknown IDs.
DUMMY_HASH = hash_password("dummy-password-for-constant-time")


def _token_hash(token: str) -> str:
    """Bearer tokens are compared and stored as SHA-256 digests only."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: str, role: str) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=config.SESSION_TTL_HOURS)
    execute(
        "INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
        (_token_hash(token), user_id, role, utc_now(), expires.isoformat()),
    )
    return token


def destroy_session(token: str) -> None:
    execute("DELETE FROM sessions WHERE token = ?", (_token_hash(token),))


def revoke_user_sessions(user_id: str) -> None:
    """Called whenever a password changes so old tokens stop working at once."""
    execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))


def current_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header.split(" ", 1)[1]
    session = query_one("SELECT * FROM sessions WHERE token = ?", (_token_hash(token),))
    if session is None:
        return None
    if datetime.fromisoformat(session["expires_at"]) < datetime.now(timezone.utc):
        destroy_session(token)
        return None
    user = query_one("SELECT * FROM users WHERE id = ?", (session["user_id"],))
    if user is None or not user["active"]:
        return None
    g.session_token = token
    return user


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"message": "Your session has expired. Please sign in again."}), 401
        g.user = user
        return view(*args, **kwargs)

    return wrapper


def roles_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            user = current_user()
            if user is None:
                return jsonify({"message": "Your session has expired. Please sign in again."}), 401
            if user["role"] not in roles:
                return (
                    jsonify({"message": "You do not have permission to perform this action."}),
                    403,
                )
            g.user = user
            return view(*args, **kwargs)

        return wrapper

    return decorator