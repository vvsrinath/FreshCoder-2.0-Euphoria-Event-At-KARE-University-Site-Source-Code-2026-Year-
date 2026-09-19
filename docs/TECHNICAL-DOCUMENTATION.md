# Fresh Coders 2.0 — Euphoria 2026 : Complete Technical Documentation

Examination platform for the **"Fresh Coders 2.0"** event at **KARE University –
Euphoria 2026** (Techno-Management Meet, Department of Freshman Engineering).

> Developer / creator / contributor: **vvsrinath** (`vvsrinath0@gmail.com`).
> Frontend repo: https://github.com/vvsrinath/FreshCoder-2.0-Euphoria-Event-At-KARE-University-Site-Source-Code-2026-Year

---

## 1. What the platform does

| Portal        | Audience      | Capabilities |
|---------------|---------------|--------------|
| Public        | Everyone      | Landing page, developers page, convenors page, login |
| Student       | Students      | See assigned tests, waiting room, take the timed exam (full-screen, auto-proctored), see results after publish, profile & support |
| Staff         | Invigilators  | Test builder, question bank, live monitoring with risk scores, edit-request approval, results, security events, audit logs |
| Admin         | Super admins  | Dashboard, student management (add/import), staff accounts, event management |

Demo accounts (seed data): `DEV001/dev@2026`, `ADMIN001/admin@2026`,
`STAFF001|STAFF002/staff@2026`, `ST2026001–ST2026005/student@2026`.

---

## 2. Tech stack (tech approach)

### Frontend (this repo) — React + TypeScript SPA
- **React 18** + **TypeScript 5** (strict, typed API layer)
- **Vite 5** build (fast dev, static deploy), React Router v6 (3 protected portals)
- **Tailwind CSS 3.4** + `tailwind-merge` (utility styling)
- **framer-motion** (page/transition animation), **lucide-react** (icons), **sonner** (toasts)
- Single API client `src/services/api.ts` — identical contract whether it talks to
  the in-browser mock backend or the real Flask API
- `AuthContext` + `ProtectedRoute` role guard on every route

### Backend — Flask 3 (Python)
- **Flask 3 + Flask-Cors** REST API (`src/api/*` blueprints)
- **sqlite3** by default, **Turso (libsql)** when `TURSO_DB_URL` is set — same
  query helpers either way (`src/backend/database.py`)
- Server-side **grading** (`grading.py`) — a score is never accepted from the client
- **Proctoring heuristics** (`proctor.py`) → weighted risk scores from security-event streams
- **Reporting views + leaderboard** (`reporting.py`, SQL views in `schema.sql`)
- **CSV export + database backup + session purge** (`export.py`, `cli.py`)
- Demo seed data (`seed_database.py`), pytest test suite (23 tests)

### Database — SQLite / Turso
- 17 tables + 5 reporting views (see §5)
- Local file for development, **Turso edge SQLite** (libsql) for the deployed API
  (token-scoped, schema applied automatically on boot)

---

## 3. Architecture — how it works

```
Browser (React SPA)
   │  VITE_API_BASE_URL set?  (src/services/api.ts)
   │
   ├─ NO  → in-browser mock backend (src/services/server/* + src/services/db.ts)
   │        demo mode: zero servers, works on Netlify static hosting out of the box
   │
   └─ YES → fetch(`${BASE_URL}/api/...`)  →  Flask API (host anywhere: Render/Railway/Fly/VPS)
                                               │
                                               └─ get_db() → local SQLite file
                                                              │  OR  Turso (libsql) cloud DB
```

### Dual-backend contract
The frontend talks to **one endpoint contract**. Every route the Flask backend
enforces (auth, authorization, deadlines, attempt state, grading) is mirrored by
`src/services/server/*` so the demo behaves identically and the client is never
the authority. Set one env var and the same build switches to the real backend.

### Runtime flow — student exam
1. Student logs in via `POST /api/auth/login` → server validates PBKDF2 hash,
   records throttling/security events, issues a random bearer token
   (stored only as SHA-256 in `sessions`).
2. `GET /api/student/tests/:id` → assigned test + its questions (frozen).
3. `POST /api/student/tests/:id/start` → creates an `attempt` (status, question
   set frozen at start), starts the timer window.
4. During the exam the client sends **heartbeats** + **monitoring events**
   (fullscreen exit, tab changes, clipboard…) → `security_events` table.
5. `POST /api/student/attempts/:id/lock` locks an answer (an edit gate enables
   staff-approved edits via `edit_requests`).
6. `POST /api/student/attempts/:id/submit` → server grades every answer
   (`grading.py`), stores the result + breakdown, freezes question versions.
7. Staff see **live risk scores** (`proctor.py`): each event type has a weight
   (`data/monitoring_signals.json`), bursts of events add extra weight →
   CLEAR/LOW/MODERATE/HIGH.

### Admin/staff flows
- Staff build tests (question selection mode, distribution presets), schedule,
  start/stop, force-stop, duplicate; every timing change is audited.
- Live monitoring: lock/unlock students, force-submit, approve/deny edit requests.
- Admin: import/create students, manage staff accounts, manage event metadata.

---

## 4. Backend module map

| File                      | Responsibility |
|---------------------------|----------------|
| `app.py`                  | Flask app factory, CORS, blueprints, `init_db()` on boot, health check |
| `config.py`               | All settings from env (secrets never in code) |
| `database.py`             | Query helpers, `SqlRow`/cursor shim, schema splitter, open SQLite or Turso |
| `schema.sql`              | 17 tables + 5 views, indexes |
| `auth.py`                 | PBKDF2 hashing, token sessions (SHA-256), `login_required`, `roles_required` |
| `routes/auth_routes.py`   | Login/logout/me/security-events, login throttling, portal↔role map |
| `routes/student_routes.py`| Student dashboard, tests, attempts, answers, submission, results |
| `routes/staff_routes.py`  | Tests, questions, live monitoring, edit requests, results, logs |
| `routes/admin_routes.py`  | Overview, students, staff, events |
| `grading.py`              | Server-side, per-type grading (MCQ/TRUE_FALSE/FILL_BLANK/OUTPUT/CODE/DEBUGGING) |
| `proctor.py`              | Weighted risk scoring + burst detection from security events |
| `reporting.py`            | Leaderboard, test snapshot, per-question usage, flag dashboards |
| `export.py`               | CSV exports, SQLite snapshot backup (incl. Turso→file), session purge |
| `cli.py`                  | `export-audit-logs`, `export-security-events`, `backup`, `purge-sessions` |
| `seed_database.py`        | Idempotent demo data seeding |
| `tests/`                  | 23 pytest tests (isolated local DB, never the cloud DB) |

---

## 5. Data model (schema.sql)

**Tables:** `users`, `events`, `tests`, `questions`, `question_versions`,
`test_questions`, `student_test_assignments`, `attempts`, `frozen_questions`,
`answers`, `edit_requests`, `results`, `security_events`, `audit_logs`,
`sessions`, `timing_changes`.

**Roles:** `DEVELOPER`, `SUPER_ADMIN`, `STAFF`, `STUDENT`.

Key design points:
- `frozen_questions` snapshots the exact question content at attempt start so a
  mid-test key fix never re-grades an in-flight attempt.
- `questions` edits version -> immutable row in `question_versions` for historical data.
- `attempts` has `UNIQUE(test_id, student_id)`; timers are enforced server-side.
- `audit_logs` + `security_events` record every sensitive action.
- **Views:** `v_result_summary`, `v_leaderboard`, `v_test_snapshot`,
  `v_question_usage`, `v_timing_audit`.

---

## 6. Security approach (design decisions)

- Passwords: **PBKDF2-SHA256** with per-user salt (Werkzeug); unknown IDs still get
  a hash comparison → response-time tampering can't enumerate accounts.
- Sessions: random 32-byte tokens; only **SHA-256 digests** stored; TTL enforced;
  password change revokes all sessions immediately.
- Login throttling: 5 rapid failures = temporary lockout (per user+IP).
- Authorization: `roles_required()` on every protected endpoint; client-side role
  guards are UX only — the server enforces.
- Grading is **server-side only**; code answers are stored for manual review and
  **never executed** in the Flask process.
- SQL: 100% parameterised queries.
- Secrets: `.env`-driven, never committed; `.env`/`.env.*` are gitignored.
- Data: Turso DB is protected by a scoped, minted database token.

---

## 7. Local development

```bash
# Frontend (repo root)
npm install
npm run dev            # http://localhost:5173  (demo mode, no server needed)

# Backend (src/backend)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add TURSO_DB_URL + TURSO_AUTH_TOKEN to use Turso
python app.py          # http://localhost:5000/api/health

# Point the frontend at the real API (root .env)
VITE_API_BASE_URL=http://localhost:5000
```

Tests (always local SQLite, never the cloud DB):
```bash
cd src/backend && pytest        # 23 passed
```

---

## 8. Deployment — summary (details in docs/DEPLOYMENT.md)

| Target              | What this repo deploys                | Required env |
|---------------------|---------------------------------------|--------------|
| **Netlify**         | Static Vite build (`dist`), demo mode  | none (optional `VITE_API_BASE_URL`) |
| **Render / Railway / Fly.io / VPS** | The Flask API (`src/backend`) | `SECRET_KEY`, `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`, `CORS_ORIGINS`, `FLASK_ENV=production` |
| **Turso**           | Cloud SQLite (already wired)           | minted DB token |

`netlify.env.example` ships in this repo; real values live in the gitignored
`.env.netlify` (and `src/backend/.env`).