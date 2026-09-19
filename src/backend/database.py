"""SQLite / Turso (libsql) access helpers. All queries are parameterised.

The backend runs on a local SQLite file by default. When ``TURSO_DB_URL`` is
configured it connects to a Turso cloud database instead (libsql protocol) using
the same helper surface, so routes never know which engine is in play.
"""
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import g

from config import config

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SqlRow(dict):
    """dict-like row that also supports sqlite3.Row-style access (``row[0]``,
    ``row["col"]``, ``row.col``, ``row.keys()``)."""

    __slots__ = ("_values",)

    def __new__(cls, keys, values):
        obj = super().__new__(cls)
        obj._values = tuple(values)
        for key, value in zip(keys, values):
            if key is not None:
                dict.__setitem__(obj, key, value)
        return obj

    def __getitem__(self, key):
        try:
            return dict.__getitem__(self, key)
        except KeyError:
            if isinstance(key, (int, slice)):
                return self._values[key]
            raise

    def __init__(self, keys, values):
        # Items are already set in __new__; the explicit init prevents
        # dict.__init__ from swallowing (keys, values) as constructor args.
        pass

    def __getattr__(self, name):
        try:
            return dict.__getitem__(self, name)
        except KeyError:
            raise AttributeError(name) from None


class _CursorShim:
    """Normalises a libsql cursor to the sqlite3 cursor surface we rely on."""

    def __init__(self, cursor):
        self._cursor = cursor

    def _columns(self):
        return [d[0] for d in (self._cursor.description or ())]

    def _wrap(self, row):
        return None if row is None else SqlRow(self._columns(), row)

    def fetchall(self):
        return [self._wrap(row) for row in self._cursor.fetchall()]

    def fetchone(self):
        return self._wrap(self._cursor.fetchone())

    def fetchmany(self, size=None):
        return [self._wrap(row) for row in self._cursor.fetchmany(size)]

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return self._cursor.lastrowid

    def close(self):
        self._cursor.close()

    def __iter__(self):
        return iter(self.fetchall())


class _Db:
    """libsql connection exposed with the sqlite3 API subset we use."""

    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        return _CursorShim(self._raw.execute(sql, params))

    def cursor(self):
        return _CursorShim(self._raw.cursor())

    def executescript(self, script):
        self._raw.executescript(script)

    def commit(self):
        return self._raw.commit()

    def rollback(self):
        return self._raw.rollback()

    def close(self):
        return self._raw.close()


def _open_turso_connection():
    import libsql

    return _Db(
        libsql.connect(
            database=config.TURSO_DB_URL,
            auth_token=config.TURSO_AUTH_TOKEN or "",
        )
    )


def _open_sqlite_connection():
    os.makedirs(os.path.dirname(config.DATABASE_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(config.DATABASE_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")  # better concurrency for ~500 clients
    return conn


def get_db():
    if "db" not in g:
        if config.is_turso:
            g.db = _open_turso_connection()
        else:
            g.db = _open_sqlite_connection()
    return g.db


def close_db(_exception=None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def _schema_statements() -> list:
    """Split schema.sql into individual statements (safe for remote sqld,
    which does not accept multi-statement scripts). Comment lines are
    stripped first and each statement is expected to end with ``;``, so a
    single statement per string is guaranteed even with one newline."""
    statements, buffer = [], []
    for line in SCHEMA_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        buffer.append(line)
        if stripped.endswith(";"):
            statements.append("\n".join(buffer).strip())
            buffer = []
    if buffer:
        statements.append("\n".join(buffer).strip())
    return statements


def init_db() -> None:
    conn = get_db()
    if config.is_turso:
        for statement in _schema_statements():
            conn.execute(statement)
    else:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.commit()


def query(sql: str, params: tuple = ()) -> list:
    return get_db().execute(sql, params).fetchall()


def query_one(sql: str, params: tuple = ()):
    return get_db().execute(sql, params).fetchone()


def execute(sql: str, params: tuple = ()):
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