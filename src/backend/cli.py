"""Maintenance CLI for the Fresh Coders backend.

Usage (run from src/backend so imports resolve):
    python cli.py export-audit-logs [--search X]
    python cli.py export-security-events [--test-id T1001]
    python cli.py backup [--output path.sqlite]
    python cli.py purge-sessions
"""
import argparse
import sys
from pathlib import Path

from app import create_app
from export import (
    audit_logs_csv,
    backup_database,
    purge_expired_sessions,
    security_events_csv,
)


def _write_or_print(text: str, output):
    if output:
        path = Path(output)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"Wrote {len(text)} bytes to {path}")
    else:
        sys.stdout.write(text)


def _configure_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cli",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    audit = sub.add_parser("export-audit-logs", help="Export audit logs as CSV")
    audit.add_argument("--search", default="", help="filter actor/action/target")
    audit.add_argument("--output", default="", help="write to file instead of stdout")

    security = sub.add_parser("export-security-events", help="Export security events as CSV")
    security.add_argument("--test-id", default="", help="restrict to one test")
    security.add_argument("--output", default="", help="write to file instead of stdout")

    backup = sub.add_parser("backup", help="Snapshot the SQLite database")
    backup.add_argument("--output", default="euphoria-backup.sqlite")

    sub.add_parser("purge-sessions", help="Delete expired sessions")

    return parser


def main(argv=None) -> int:
    args = _configure_parser().parse_args(argv)
    try:
        if args.command == "backup":
            backup_database(args.output)
            print(f"Backup written to {args.output}")
            return 0
        with create_app().app_context():
            if args.command == "export-audit-logs":
                _write_or_print(audit_logs_csv(args.search), args.output)
            elif args.command == "export-security-events":
                _write_or_print(security_events_csv(args.test_id), args.output)
            elif args.command == "purge-sessions":
                removed = purge_expired_sessions()
                print(f"Removed {removed} expired session(s)")
        return 0
    except Exception as error:  # noqa: BLE001 - friendly CLI errors
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())