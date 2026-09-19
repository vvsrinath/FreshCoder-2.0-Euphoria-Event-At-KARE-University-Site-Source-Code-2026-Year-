-- Fresh Coders 2.0 — Euphoria 2026
-- SQLite schema. Foreign keys are enforced at connection time (PRAGMA foreign_keys = ON).

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    role          TEXT NOT NULL CHECK (role IN ('DEVELOPER','SUPER_ADMIN','STAFF','STUDENT')),
    name          TEXT NOT NULL,
    email         TEXT,
    password_hash TEXT NOT NULL,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS events (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    description       TEXT,
    department        TEXT,
    start_date        TEXT,
    end_date          TEXT,
    venue             TEXT,
    status            TEXT NOT NULL DEFAULT 'DRAFT',
    registration_site TEXT,
    registration_fee  TEXT,
    prize_pool        TEXT
);

CREATE TABLE IF NOT EXISTS tests (
    id                TEXT PRIMARY KEY,
    event_id          TEXT NOT NULL REFERENCES events(id),
    name              TEXT NOT NULL,
    description       TEXT,
    type              TEXT NOT NULL,
    question_count    INTEGER NOT NULL,
    duration_minutes  INTEGER NOT NULL,
    selection_mode    TEXT NOT NULL DEFAULT 'RANDOM',
    distribution      TEXT NOT NULL DEFAULT '{}',
    manual_question_ids TEXT NOT NULL DEFAULT '[]',
    scheduled_start   TEXT,
    status            TEXT NOT NULL DEFAULT 'DRAFT',
    results_published INTEGER NOT NULL DEFAULT 0,
    started_at        TEXT,
    stopped_at        TEXT,
    created_by        TEXT NOT NULL REFERENCES users(id),
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tests_event ON tests(event_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);

CREATE TABLE IF NOT EXISTS questions (
    id           TEXT PRIMARY KEY,
    version      INTEGER NOT NULL DEFAULT 1,
    title        TEXT NOT NULL,
    type         TEXT NOT NULL,
    topic        TEXT,
    difficulty   TEXT NOT NULL DEFAULT 'EASY',
    marks        INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'ACTIVE',
    prompt       TEXT NOT NULL,
    code         TEXT,
    options      TEXT,            -- JSON array
    answer       TEXT,
    alternatives TEXT,            -- JSON array
    explanation  TEXT,
    input_format TEXT,
    output_format TEXT,
    constraints  TEXT,
    sample_input TEXT,
    sample_output TEXT,
    test_cases   TEXT,            -- JSON array
    created_by   TEXT REFERENCES users(id),
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);

-- Historical exam data is preserved: edits to in-use questions create a version row.
CREATE TABLE IF NOT EXISTS question_versions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL REFERENCES questions(id),
    version     INTEGER NOT NULL,
    snapshot    TEXT NOT NULL,     -- JSON
    changed_by  TEXT REFERENCES users(id),
    reason      TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_questions (
    test_id     TEXT NOT NULL REFERENCES tests(id),
    question_id TEXT NOT NULL REFERENCES questions(id),
    position    INTEGER NOT NULL,
    PRIMARY KEY (test_id, question_id)
);

CREATE TABLE IF NOT EXISTS student_test_assignments (
    test_id    TEXT NOT NULL REFERENCES tests(id),
    student_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (test_id, student_id)
);

CREATE TABLE IF NOT EXISTS attempts (
    id               TEXT PRIMARY KEY,
    test_id          TEXT NOT NULL REFERENCES tests(id),
    student_id       TEXT NOT NULL REFERENCES users(id),
    status           TEXT NOT NULL DEFAULT 'NOT_STARTED',
    question_ids     TEXT NOT NULL DEFAULT '[]',  -- JSON array, frozen at start
    started_at       TEXT,
    deadline         TEXT,
    submitted_at     TEXT,
    locked_by_staff  TEXT REFERENCES users(id),
    lock_reason      TEXT,
    current_question INTEGER NOT NULL DEFAULT 0,
    last_activity    TEXT,
    session_token    TEXT,
    UNIQUE (test_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);

-- Freeze the exact question content (grade + display) an attempt started with,
-- so a mid-test answer-key correction never re-grades an in-flight attempt.
CREATE TABLE IF NOT EXISTS frozen_questions (
    attempt_id  TEXT NOT NULL REFERENCES attempts(id),
    question_id TEXT NOT NULL REFERENCES questions(id),
    version     INTEGER NOT NULL,
    snapshot    TEXT NOT NULL,     -- JSON: full question row at attempt start
    PRIMARY KEY (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_frozen_attempt ON frozen_questions(attempt_id);

CREATE TABLE IF NOT EXISTS answers (
    attempt_id   TEXT NOT NULL REFERENCES attempts(id),
    question_id  TEXT NOT NULL REFERENCES questions(id),
    value        TEXT,
    locked       INTEGER NOT NULL DEFAULT 0,
    edit_granted INTEGER NOT NULL DEFAULT 0,
    updated_at   TEXT NOT NULL,
    PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS edit_requests (
    id             TEXT PRIMARY KEY,
    attempt_id     TEXT NOT NULL REFERENCES attempts(id),
    student_id     TEXT NOT NULL REFERENCES users(id),
    test_id        TEXT NOT NULL REFERENCES tests(id),
    question_id    TEXT NOT NULL REFERENCES questions(id),
    current_answer TEXT,
    reason         TEXT,
    status         TEXT NOT NULL DEFAULT 'PENDING',
    decided_by     TEXT REFERENCES users(id),
    decided_at     TEXT,
    created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON edit_requests(status);

CREATE TABLE IF NOT EXISTS results (
    id                TEXT PRIMARY KEY,
    attempt_id        TEXT NOT NULL UNIQUE REFERENCES attempts(id),
    test_id           TEXT NOT NULL REFERENCES tests(id),
    student_id        TEXT NOT NULL REFERENCES users(id),
    total_questions   INTEGER NOT NULL,
    attempted         INTEGER NOT NULL,
    correct           INTEGER NOT NULL,
    wrong             INTEGER NOT NULL,
    unanswered        INTEGER NOT NULL,
    score             INTEGER NOT NULL,
    max_score         INTEGER NOT NULL,
    percentage        REAL NOT NULL,
    time_used_seconds INTEGER NOT NULL,
    submitted_at      TEXT NOT NULL,
    published         INTEGER NOT NULL DEFAULT 0,
    breakdown         TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_results_test ON results(test_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);

CREATE TABLE IF NOT EXISTS security_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    actor      TEXT,
    role       TEXT,
    test_id    TEXT,
    attempt_id TEXT,
    detail     TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_attempt ON security_events(attempt_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor      TEXT NOT NULL,
    role       TEXT NOT NULL,
    action     TEXT NOT NULL,
    target     TEXT,
    metadata   TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    role       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS timing_changes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id      TEXT NOT NULL REFERENCES tests(id),
    old_duration INTEGER NOT NULL,
    new_duration INTEGER NOT NULL,
    staff_id     TEXT NOT NULL REFERENCES users(id),
    reason       TEXT,
    created_at   TEXT NOT NULL
);
