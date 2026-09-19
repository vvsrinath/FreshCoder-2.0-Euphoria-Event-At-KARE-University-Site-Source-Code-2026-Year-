"""Report exports and database maintenance helpers.

Everything here reads committed data only and is safe to schedule or run by
hand via `python cli.py`. CSV text is built with the stdlib `csv` module so
quoting and escaping stay correct.
"""
import csv
import io
import sqlite3
from datetime import datetime, timezone

from config import config
from database import execute, query

AUDIT_COLUMNS = ("id", "actor", "role", "action", "target", "metadata", "createdAt")
SECURITY_COLUMNS = ("id", "type", "actor", "role", "testId", "attemptId", "detail", "createdAt")


def _rows_to_csv(columns, rows) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(columns)
    for row in rows:
        writer.writerow(
            [row[col] if col in row.keys() and row[col] is not None else "" for col in columns]
        )
    return buffer.getvalue()


def audit_logs_csv(term: str = "") -> str:
    sql = (
        "SELECT id, actor, role, action, target, metadata, created_at AS createdAt"
        " FROM audit_logs WHERE 1 = 1"
    )
    params = []
    if term:
        sql += " AND (LOWER(actor) LIKE ? OR LOWER(action) LIKE ? OR LOWER(target) LIKE ?)"
        pattern = f"%{term.lower()}%"
        params.extend([pattern, pattern, pattern])
    rows = query(sql + " ORDER BY id DESC LIMIT 5000", tuple(params))
    return _rows_to_csv(AUDIT_COLUMNS, rows)


def security_events_csv(test_id: str = "") -> str:
    sql = (
        "SELECT id, type, actor, role, test_id AS testId, attempt_id AS attemptId,"
        " detail, created_at AS createdAt FROM security_events WHERE 1 = 1"
    )
    params = []
    if test_id:
        sql += " AND test_id = ?"
        params.append(test_id)
    rows = query(sql + " ORDER BY id DESC LIMIT 5000", tuple(params))
    return _rows_to_csv(SECURITY_COLUMNS, rows)


def _turso_backup(target: sqlite3.Connection) -> int:
    """Copy every table from the remote Turso database into a local SQLite file."""
    copied = 0
    tables = [row["name"] for row in query("SELECT name FROM sqlite_master WHERE type = 'table'")]
    for table in tables:
        if table.startswith("sqlite_"):
            continue
        columns = [(row["name"], row["type"]) for row in query(f"PRAGMA table_info({table})")]
        names = ", ".join(f'"{name}" {typ}' for name, typ in columns)
        target.execute(f'CREATE TABLE "{table}" ({names})')
        column_list = ",".join(f'"{name}"' for name, _ in columns)
        rows = [tuple(row[col] for col, _ in columns) for row in query(f'SELECT * FROM "{table}"')]
        if rows:
            placeholders = ",".join("?" * len(columns))
            target.executemany(
                f'INSERT INTO "{table}" ({column_list}) VALUES ({placeholders})', rows
            )
            copied += len(rows)
    return copied


def backup_database(destination: str) -> int:
    """Online database backup; returns the number of rows persisted."""
    target = sqlite3.connect(destination)
    try:
        if config.is_turso:
            copied = _turso_backup(target)
        else:
            source = sqlite3.connect(config.DATABASE_PATH)
            try:
                source.backup(target)
                copied = target.total_changes
            finally:
                source.close()
        target.commit()
        return copied
    finally:
        target.close()


def purge_expired_sessions() -> int:
    """Delete stale sessions and report how many were removed."""
    now = datetime.now(timezone.utc).isoformat()
    cursor = execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    return cursor.rowcount