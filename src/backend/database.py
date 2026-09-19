"""SQLite access helpers. All queries are parameterised."""
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import g

from config import config

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        os.makedirs(os.path.dirname(config.DATABASE_PATH) or ".", exist_ok=True)
        conn = sqlite3.connect(config.DATABASE_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")  # better concurrency for ~500 clients
        g.db = conn
    return g.db


def close_db(_exception=None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db() -> None:
    conn = get_db()
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.commit()


def query(sql: str, params: tuple = ()) -> list:
    return get_db().execute(sql, params).fetchall()


def query_one(sql: str, params: tuple = ()):
    return get_db().execute(sql, params).fetchone()


def execute(sql: str, params: tuple = ()) -> sqlite3.Cursor:
    conn = get_db()
    cur = conn.execute(sql, params)
    conn.commit()
    return cur


def audit(actor: str, role: str, action: str, target: str = "", metadata: str = "") -> None:
    execute(
        "INSERT INTO audit_logs (actor, role, action, target, metadata, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (actor, role, action, target, metadata, utc_now()),
    )


def security_event(
    event_type: str,
    actor: str,
    role: str,
    detail: str = "",
    test_id: str = None,
    attempt_id: str = None,
) -> None:
    execute(
        "INSERT INTO security_events (type, actor, role, test_id, attempt_id, detail, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (event_type, actor, role, test_id, attempt_id, detail, utc_now()),
    )


def loads(value, fallback):
    if value in (None, ""):
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback
