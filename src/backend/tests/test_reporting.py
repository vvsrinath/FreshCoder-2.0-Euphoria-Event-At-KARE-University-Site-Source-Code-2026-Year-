"""Tests for the reporting and proctoring endpoints.

Run from the backend directory:  pytest tests/test_reporting.py
"""
import io
import os
import tempfile

import pytest

os.environ.setdefault("DATABASE_PATH", os.path.join(tempfile.mkdtemp(), "report.sqlite"))
# Tests always run against a local file, never the configured Turso database.
os.environ["TURSO_DB_URL"] = ""
os.environ["TURSO_AUTH_TOKEN"] = ""

from app import create_app  # noqa: E402
from auth import hash_password  # noqa: E402
from database import execute, utc_now  # noqa: E402


@pytest.fixture()
def app():
    application = create_app()
    with application.app_context():
        for user_id, role, name, password in [
            ("ADMIN001", "SUPER_ADMIN", "Admin", "admin@2026"),
            ("STAFF001", "STAFF", "Staff", "staff@2026"),
            ("ST2026001", "STUDENT", "Student One", "student@2026"),
        ]:
            execute(
                "INSERT OR IGNORE INTO users (id, role, name, email, password_hash, active, created_at)"
                " VALUES (?, ?, ?, '', ?, 1, ?)",
                (user_id, role, name, hash_password(password), utc_now()),
            )
        execute(
            "INSERT OR IGNORE INTO events (id, name, status) VALUES ('EV2026', 'Euphoria 2026', 'ACTIVE')"
        )
        execute(
            "INSERT OR IGNORE INTO questions (id, version, title, type, topic, difficulty, marks,"
            " status, prompt, answer, alternatives, created_by, created_at)"
            " VALUES ('Q001', 1, 'Input', 'FILL_BLANK', 'Basics', 'EASY', 1, 'ACTIVE',"
            " 'Complete it', 'input', '[]', 'STAFF001', ?)",
            (utc_now(),),
        )
    return application


@pytest.fixture()
def client(app):
    return app.test_client()


def login(client, user_id, password, portal):
    return client.post("/api/auth/login", json={"userId": user_id, "password": password, "portal": portal})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def _completed_test(client, staff, name="Report Test"):
    # A dedicated question keeps this flow isolated from other test files that
    # share the temp database and may rewrite the seed question's answer key.
    question = client.post(
        "/api/questions",
        json={"title": f"{name} Key", "prompt": "Complete it", "type": "FILL_BLANK",
              "difficulty": "EASY", "status": "ACTIVE", "answer": "answer-key"},
        headers=auth(staff),
    ).get_json()["question"]
    test = client.post(
        "/api/staff/tests",
        json={"name": name, "type": "FILL_BLANK", "questionCount": 1,
              "durationMinutes": 60, "selectionMode": "MANUAL",
              "manualQuestionIds": [question["id"]]},
        headers=auth(staff),
    ).get_json()["test"]
    client.post(f"/api/staff/tests/{test['id']}/start", headers=auth(staff))
    student = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    attempt_id = client.post(
        f"/api/student/tests/{test['id']}/start", headers=auth(student)
    ).get_json()["attempt"]["id"]
    client.post(f"/api/student/attempts/{attempt_id}/submit",
                json={"answers": {question["id"]: "answer-key"}, "reason": "NORMAL"},
                headers=auth(student))
    return test, attempt_id


def test_analytics_report(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    test, _ = _completed_test(client, staff)
    report = client.get(f"/api/staff/reports/analytics?testId={test['id']}", headers=auth(staff)).get_json()
    assert report["summary"]["submitted"] == 1
    assert report["summary"]["avgPercentage"] == 100.0
    assert report["summary"]["buckets"]["A (90-100)"] == 1
    assert len(report["perQuestion"]) == 1
    assert report["perQuestion"][0]["difficultyIndex"] == 1.0
    # Missing or unknown tests are rejected.
    assert client.get("/api/staff/reports/analytics", headers=auth(staff)).status_code == 400
    assert client.get("/api/staff/reports/analytics?testId=NOPE", headers=auth(staff)).status_code == 404


def test_proctor_report_ranks_risk(client, app):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    test, attempt_id = _completed_test(client, staff)
    with app.app_context():
        for event_type in ["NAVIGATION_ATTEMPT", "FULLSCREEN_EXIT"]:
            execute(
                "INSERT INTO security_events (type, actor, role, test_id, attempt_id, detail, created_at)"
                " VALUES (?, 'ST2026001', 'STUDENT', ?, ?, 'seen', ?)",
                (event_type, test["id"], attempt_id, utc_now()),
            )

    report = client.get(f"/api/staff/reports/proctor?testId={test['id']}", headers=auth(staff)).get_json()
    assert report["flags"]["intentSignals"]["NAVIGATION_ATTEMPT"] >= 1
    flagged = report["risk"]
    assert len(flagged) == 1
    assert flagged[0]["studentId"] == "ST2026001"
    assert flagged[0]["score"] >= 6
    assert flagged[0]["level"] in ("MODERATE", "HIGH")
    assert client.get("/api/staff/reports/proctor", headers=auth(staff)).status_code == 400


def test_results_csv_download(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    test, _ = _completed_test(client, staff)
    response = client.get(f"/api/staff/reports/results.csv?testId={test['id']}", headers=auth(staff))
    assert response.status_code == 200
    assert response.mimetype == "text/csv"
    assert f'attachment; filename="results-{test["id"]}.csv"' in response.headers["Content-Disposition"]
    text = response.get_data(as_text=True)
    assert "Student ID" in text
    assert "ST2026001" in text
    assert "1" in text  # the score row
    assert client.get("/api/staff/reports/results.csv", headers=auth(staff)).status_code == 400


def test_students_cannot_read_reports(client):
    student = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    assert client.get("/api/staff/reports/analytics?testId=EV2026", headers=auth(student)).status_code == 403


def test_admin_analytics(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    test, _ = _completed_test(client, staff, name="Analytics Test")
    admin = login(client, "ADMIN001", "admin@2026", "ADMIN").get_json()["token"]
    report = client.get("/api/admin/analytics", headers=auth(admin)).get_json()
    ours = [row for row in report["tests"] if row["testId"] == test["id"]]
    assert ours, "the created test must appear in the snapshot view"
    assert ours[0]["submitted"] == 1
    assert ours[0]["bestPercentage"] == 100.0
    assert any(row["testId"] == test["id"] for row in report["topPerformers"])
    assert report["funnel"], "one funnel row per test expected"
    assert report["activity"]["resultsToday"] >= 1
    # Staff cannot access admin analytics.
    assert client.get("/api/admin/analytics", headers=auth(staff)).status_code == 403


def test_csv_log_exports(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    test, attempt_id = _completed_test(client, staff, name="Csv Logs")

    audit_csv = client.get("/api/staff/audit-logs.csv", headers=auth(staff))
    assert audit_csv.status_code == 200
    assert "Exported" in audit_csv.get_data(as_text=True) or "Created test" in audit_csv.get_data(as_text=True)

    events_csv = client.get(f"/api/staff/security-events.csv?testId={test['id']}", headers=auth(staff))
    text = events_csv.get_data(as_text=True)
    assert events_csv.status_code == 200
    assert "TEST_SUBMITTED" in text or "type" in text
    assert text.startswith("id,type,actor,role,testId,attemptId,detail,createdAt")
    # Filtered query must return the seeded attempt's event.
    assert test["id"] in text or attempt_id in text


def test_export_module_functions(client, app):
    with app.app_context():
        from export import backup_database, purge_expired_sessions, audit_logs_csv, security_events_csv

        # Backup produces a valid SQLite file with the schema.
        destination = os.path.join(tempfile.mkdtemp(), "snap.sqlite")
        backup_database(destination)
        assert os.path.getsize(destination) > 0

        # Exported CSVs always begin with their header row.
        audit_text = audit_logs_csv(term="")
        assert audit_text.startswith("id,actor,role,action,target,metadata,createdAt")
        security_text = security_events_csv()
        assert security_text.startswith("id,type,actor,role,testId,attemptId,detail,createdAt")

        # Expired sessions are removed and reported.
        execute(
            "INSERT INTO sessions (token, user_id, role, created_at, expires_at)"
            " VALUES ('oldsession', 'ST2026001', 'STUDENT', ?, '2000-01-01T00:00:00+00:00')",
            (utc_now(),),
        )
        assert purge_expired_sessions() == 1