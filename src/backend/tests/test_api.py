"""API tests: authentication, authorization, test lifecycle, exam flow, results.

Run from the backend directory:  pytest
"""
import os
import tempfile

import pytest

os.environ.setdefault("DATABASE_PATH", os.path.join(tempfile.mkdtemp(), "test.sqlite"))

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
            ("ST2026002", "STUDENT", "Student Two", "student@2026"),
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
    response = client.post("/api/auth/login", json={"userId": user_id, "password": password, "portal": portal})
    return response


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_success_and_failure(client):
    assert login(client, "ST2026001", "student@2026", "STUDENT").status_code == 200
    assert login(client, "ST2026001", "wrong", "STUDENT").status_code == 401
    # A student cannot sign in through the staff portal.
    assert login(client, "ST2026001", "student@2026", "STAFF").status_code == 403


def test_unauthenticated_access_is_blocked(client):
    assert client.get("/api/staff/dashboard").status_code == 401
    assert client.get("/api/admin/students").status_code == 401


def test_student_cannot_reach_staff_endpoints(client):
    token = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    assert client.get("/api/staff/dashboard", headers=auth(token)).status_code == 403
    assert client.post("/api/staff/tests", json={"name": "X"}, headers=auth(token)).status_code == 403


def test_staff_cannot_create_students(client):
    token = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    response = client.post("/api/admin/students", json={"id": "ST999", "name": "N", "password": "p"},
                           headers=auth(token))
    assert response.status_code == 403


def test_full_exam_flow(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    created = client.post(
        "/api/staff/tests",
        json={"name": "Flow Test", "type": "FILL_BLANK", "questionCount": 1,
              "durationMinutes": 30, "selectionMode": "RANDOM"},
        headers=auth(staff),
    ).get_json()["test"]

    student = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    # The test is not open yet.
    assert client.post(f"/api/student/tests/{created['id']}/start", headers=auth(student)).status_code == 409

    client.post(f"/api/staff/tests/{created['id']}/start", headers=auth(staff))
    attempt = client.post(f"/api/student/tests/{created['id']}/start", headers=auth(student)).get_json()
    attempt_id = attempt["attempt"]["id"]
    question_id = attempt["questions"][0]["id"]

    # Locking an answer, then failing to re-lock it.
    assert client.post(f"/api/student/attempts/{attempt_id}/lock",
                       json={"questionId": question_id, "value": "input"},
                       headers=auth(student)).status_code == 200
    assert client.post(f"/api/student/attempts/{attempt_id}/lock",
                       json={"questionId": question_id, "value": "other"},
                       headers=auth(student)).status_code == 409

    # Another student may not read this attempt.
    other = login(client, "ST2026002", "student@2026", "STUDENT").get_json()["token"]
    assert client.get(f"/api/student/attempts/{attempt_id}", headers=auth(other)).status_code == 403

    # Edit request, approval, submission, scoring.
    request_id = client.post(f"/api/student/attempts/{attempt_id}/edit-request",
                             json={"questionId": question_id, "reason": "typo"},
                             headers=auth(student)).get_json()["request"]["id"]
    assert client.post(f"/api/staff/edit-requests/{request_id}/approve", headers=auth(staff)).status_code == 200

    submitted = client.post(f"/api/student/attempts/{attempt_id}/submit",
                            json={"answers": {question_id: "input"}, "reason": "NORMAL"},
                            headers=auth(student)).get_json()
    assert submitted["submitted"] is True

    results = client.get("/api/results", headers=auth(staff)).get_json()["results"]
    assert results[0]["score"] == 1
    assert results[0]["correct"] == 1

    # Results are hidden from the student until published.
    assert client.get("/api/student/results", headers=auth(student)).get_json()["results"] == []
    client.post("/api/results/publish", json={"testId": created["id"], "published": True}, headers=auth(staff))
    assert len(client.get("/api/student/results", headers=auth(student)).get_json()["results"]) == 1


def test_csv_import(client):
    admin = login(client, "ADMIN001", "admin@2026", "ADMIN").get_json()["token"]
    response = client.post(
        "/api/admin/students/import",
        json={"rows": [
            {"student_id": "ST2026900", "name": "Imported", "email": "i@klu.ac.in", "password": "import2026"},
            {"student_id": "", "name": "Broken", "email": "", "password": ""},
        ]},
        headers=auth(admin),
    ).get_json()
    assert response["success"] == 1
    assert response["failed"] == 1


def test_short_passwords_are_rejected(client):
    admin = login(client, "ADMIN001", "admin@2026", "ADMIN").get_json()["token"]
    response = client.post(
        "/api/admin/students",
        json={"id": "STSHORT", "name": "Short", "password": "abc"},
        headers=auth(admin),
    )
    assert response.status_code == 400
    assert login(client, "STSHORT", "abc", "STUDENT").status_code == 401


def test_login_throttle(client):
    for _ in range(5):
        assert login(client, "MYSTERY01", "wrong", "STUDENT").status_code == 401
    assert login(client, "MYSTERY01", "wrong", "STUDENT").status_code == 429


def test_deadline_expiry_auto_submits(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    created = client.post(
        "/api/staff/tests",
        json={"name": "Deadline Test", "type": "FILL_BLANK", "questionCount": 1,
              "durationMinutes": 60, "selectionMode": "RANDOM"},
        headers=auth(staff),
    ).get_json()["test"]
    client.post(f"/api/staff/tests/{created['id']}/start", headers=auth(staff))

    student = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    attempt_id = client.post(
        f"/api/student/tests/{created['id']}/start", headers=auth(student)
    ).get_json()["attempt"]["id"]

    # Simulate the window having elapsed on the server.
    with client.application.app_context():
        execute("UPDATE attempts SET deadline = ? WHERE id = ?",
                ("2000-01-01T00:00:00+00:00", attempt_id))

    beat = client.post(f"/api/student/attempts/{attempt_id}/heartbeat",
                       json={}, headers=auth(student)).get_json()
    assert beat["status"] == "TIME_EXPIRED"
    assert beat["autoSubmitted"] is True

    # Once expired, the attempt is final: edits and re-submits are refused.
    assert client.post(f"/api/student/attempts/{attempt_id}/lock",
                       json={"questionId": "Q001", "value": "input"},
                       headers=auth(student)).status_code == 409
    assert client.post(f"/api/student/attempts/{attempt_id}/submit",
                       json={"answers": {"Q001": "input"}},
                       headers=auth(student)).status_code == 409


def test_double_submit_is_rejected(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    created = client.post(
        "/api/staff/tests",
        json={"name": "Double Submit", "type": "FILL_BLANK", "questionCount": 1,
              "durationMinutes": 60, "selectionMode": "RANDOM"},
        headers=auth(staff),
    ).get_json()["test"]
    client.post(f"/api/staff/tests/{created['id']}/start", headers=auth(staff))

    student = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    attempt_id = client.post(
        f"/api/student/tests/{created['id']}/start", headers=auth(student)
    ).get_json()["attempt"]["id"]

    first = client.post(f"/api/student/attempts/{attempt_id}/submit",
                        json={"answers": {"Q001": "input"}, "reason": "NORMAL"},
                        headers=auth(student))
    assert first.status_code == 200 and first.get_json()["submitted"] is True
    assert client.post(f"/api/student/attempts/{attempt_id}/submit",
                       json={"answers": {"Q001": "input"}},
                       headers=auth(student)).status_code == 409


def test_answer_key_correction_never_regrades_active_attempts(client):
    staff = login(client, "STAFF001", "staff@2026", "STAFF").get_json()["token"]
    created = client.post(
        "/api/staff/tests",
        json={"name": "Frozen Grading", "type": "FILL_BLANK", "questionCount": 1,
              "durationMinutes": 60, "selectionMode": "RANDOM"},
        headers=auth(staff),
    ).get_json()["test"]
    client.post(f"/api/staff/tests/{created['id']}/start", headers=auth(staff))

    student = login(client, "ST2026001", "student@2026", "STUDENT").get_json()["token"]
    attempt_id = client.post(
        f"/api/student/tests/{created['id']}/start", headers=auth(student)
    ).get_json()["attempt"]["id"]

    # The staff correct the answer key mid-test.
    corrected = client.put(
        "/api/questions/Q001",
        json={"answer": "renamed-answer", "reason": "Typo in answer key"},
        headers=auth(staff),
    ).get_json()["question"]
    assert corrected["version"] == 2
    assert corrected["answer"] == "renamed-answer"

    # The student's attempt was frozen at start, so the old key still applies.
    submitted = client.post(f"/api/student/attempts/{attempt_id}/submit",
                            json={"answers": {"Q001": "input"}, "reason": "NORMAL"},
                            headers=auth(student)).get_json()
    assert submitted["submitted"] is True
    results = client.get("/api/results", headers=auth(staff)).get_json()["results"]
    mine = [r for r in results if r["testId"] == created["id"]][0]
    assert mine["correct"] == 1
    assert mine["score"] == 1
