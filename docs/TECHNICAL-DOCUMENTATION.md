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
  the in-browser mock backend, the TypeScript Netlify Functions, or the Flask API
- `AuthContext` + `ProtectedRoute` role guard on every route
- **Exam proctoring** — fullscreen enforcement, tab-switch detection, keyboard blocking

### Backend — TypeScript Netlify Functions (primary) + Flask 3 (reference)
- **TypeScript Netlify Functions** (`netlify/functions/`) — single catch-all function
  (`api.ts`) with `config.path = "/api/*"`, bundled via esbuild
- **Flask 3 + Flask-Cors** REST API (`src/backend/`) — kept as reference/backup
- **Turso (libsql)** via `@libsql/client` — HTTP transport, same DB for both backends
- Server-side **grading** (`grading.ts` / `grading.py`) — scores never accepted from client
- **Proctoring heuristics** (`proctor.ts` / `proctor.py`) — weighted risk scores from security events
- **Reporting + CSV export** (`reporting.ts`, `export.ts`)
- Demo seed data, pytest test suite (23 tests)

### Database — Turso (libSQL)
- 17 tables + 5 reporting views (see §5)
- **Turso edge SQLite** (libsql) for production — token-scoped, schema applied on boot
- Local SQLite file for development

---

## 3. Architecture — how it works

```
Browser (React SPA)
   │
   ├─ Production (Netlify)  →  /api/*  →  Netlify Functions (TypeScript)
   │                                         │
   │                                         └─ @libsql/client  →  Turso (libSQL) cloud DB
   │
   ├─ VITE_API_BASE_URL set?  (src/services/api.ts)
   │   │
   │   └─ YES → fetch(`${BASE_URL}/api/...`)  →  Flask API (Render/Railway/Fly/VPS)
   │                                              │
   │                                              └─ get_db() → Turso or local SQLite
   │
   └─ Dev mode (no env var)  →  in-browser mock backend (src/services/server/*)
                                demo mode: zero servers, works on Netlify static hosting
```

### Dual-backend contract
The frontend talks to **one endpoint contract**. Every route the TypeScript/Flask
backend enforces (auth, authorization, deadlines, attempt state, grading) is
mirrored by `src/services/server/*` so the demo behaves identically and the client
is never the authority. The same build works in all three modes.

### Security: single session per user
When a student or staff member logs in, the backend checks for existing active
sessions. If one exists, the login is **rejected with 409** ("You are already
signed in on another device. Please log out there first."). This prevents
concurrent logins on multiple devices.

### Exam proctoring & fullscreen enforcement
- **Auto-fullscreen**: browser enters fullscreen automatically when exam starts
- **Locked fullscreen**: Esc key is blocked at JS level; any fullscreen exit
  immediately re-requests fullscreen
- **CSS-hidden content**: exam content is invisible when not in fullscreen (zero flash)
- **Blocking overlay**: covers entire screen when student exits fullscreen
- **Tab-switch detection**: `visibilitychange` event → violation reported + warning
- **Keyboard blocking**: Ctrl+Tab, Ctrl+W, Ctrl+T, Alt+Tab, F11 all blocked
- **Right-click blocked**: context menu prevented
- **Navigation blocked**: browser "leave page?" dialog + violation reported
- **Violation counter**: amber badge in header, staff sees all violations in real-time
- **Staff control**: can force-submit any student who refuses to re-enter fullscreen

### Answers stored locally (browser memory only)
During the exam, student answers are stored **only in React state** — nothing is
sent to the database until:
1. **Student submits** the entire test → all answers sent at once, graded server-side
2. **Student requests an edit** on a locked answer → that answer sent to DB so staff
   can review it before approving/denying the modification

This means staff live monitoring shows student activity status but **no answer
content** during the exam.

### Runtime flow — student exam
1. Student logs in via `POST /api/auth/login` → server validates PBKDF2 hash,
   checks for existing session (rejects if already logged in elsewhere),
   records throttling/security events, issues a random bearer token
   (stored only as SHA-256 in `sessions`).
2. `GET /api/student/tests/:id` → assigned test + its questions (frozen).
3. `POST /api/student/tests/:id/start` → creates an `attempt` (status, question
   set frozen at start), starts the timer window.
4. Browser enters **fullscreen mode** automatically. Exam content is CSS-hidden
   if student exits fullscreen — blocking overlay appears.
5. During the exam the client sends **heartbeats** + **monitoring events**
   (fullscreen exit, tab changes, keyboard shortcuts, clipboard…) →
   `security_events` table. Answers stay in **React state only** (not in DB).
6. Student clicks "Lock & Next" → answer marked locked in **local state only**.
7. If student wants to change a locked answer → clicks "Request modification" →
   **that answer** is sent to DB + edit request created → staff reviews.
8. `POST /api/student/attempts/:id/submit` → **all answers** sent to DB at once,
   server grades every answer (`grading.ts`), stores result + breakdown.
9. Staff see **live risk scores** (`proctor.ts`): each event type has a weight,
   bursts of events add extra weight → CLEAR/LOW/MODERATE/HIGH.

### Admin/staff flows
- Staff build tests (question selection mode, distribution presets), schedule,
  start/stop, force-stop, duplicate; every timing change is audited.
- Live monitoring: lock/unlock students, force-submit, approve/deny edit requests.
- Admin: import/create students, manage staff accounts, manage event metadata.

---

## 4. Backend module map

### TypeScript Netlify Functions (primary backend)

| File                              | Responsibility |
|-----------------------------------|----------------|
| `netlify/functions/api.ts`        | Catch-all entry: `config.path = "/api/*"`, imports all routes |
| `netlify/functions/lib/config.ts` | Environment variables (TURSO_DB_URL, TURSO_AUTH_TOKEN, etc.) |
| `netlify/functions/lib/db.ts`     | Turso client, query/execute helpers, audit/security event logging |
| `netlify/functions/lib/http.ts`   | ApiError, ok(), csvResponse(), parseBody(), CSV writer |
| `netlify/functions/lib/auth.ts`   | PBKDF2 hashing (Werkzeug-compatible), session CRUD, requireAuth |
| `netlify/functions/lib/router.ts` | Route dispatch, method+pattern matching, auth enforcement |
| `netlify/functions/lib/grading.ts`| Server-side per-type grading (MCQ/TRUE_FALSE/FILL_BLANK/etc.) |
| `netlify/functions/lib/proctor.ts`| Weighted risk scoring + burst detection from security events |
| `netlify/functions/lib/reporting.ts` | Test summary, question analytics, CSV builders |
| `netlify/functions/lib/export.ts` | Audit log + security event CSV exports |
| `netlify/functions/lib/utils.ts`  | utcNow, parseUtc, loads (JSON), safeInt, shuffle |
| `netlify/functions/lib/routes/auth.ts`     | Login/logout/me/security-events, single-session enforcement |
| `netlify/functions/lib/routes/student.ts`  | Dashboard, tests, attempts, submit (answers sent on submit only) |
| `netlify/functions/lib/routes/staff.ts`    | Tests, questions, monitoring, edit requests, results, logs |
| `netlify/functions/lib/routes/admin.ts`    | Overview, students, staff, events, analytics |

### Flask API (reference/backup backend)

| File                      | Responsibility |
|---------------------------|----------------|
| `app.py`                  | Flask app factory, CORS, blueprints, `init_db()` on boot, health check |
| `config.py`               | All settings from env (secrets never in code) |
| `database.py`             | Query helpers, schema splitter, open SQLite or Turso |
| `schema.sql`              | 17 tables + 5 views, indexes |
| `auth.py`                 | PBKDF2 hashing, token sessions (SHA-256), `login_required`, `roles_required` |
| `routes/auth_routes.py`   | Login/logout/me/security-events, single-session enforcement |
| `routes/student_routes.py`| Student dashboard, tests, attempts, submission, results |
| `routes/staff_routes.py`  | Tests, questions, live monitoring, edit requests, results, logs |
| `routes/admin_routes.py`  | Overview, students, staff, events |
| `grading.py`              | Server-side, per-type grading |
| `proctor.py`              | Weighted risk scoring + burst detection from security events |
| `reporting.py`            | Leaderboard, test snapshot, per-question usage, flag dashboards |
| `export.py`               | CSV exports, SQLite snapshot backup, session purge |
| `cli.py`                  | CLI tools: export-audit-logs, backup, purge-sessions |
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

- Passwords: **PBKDF2-SHA256** with per-user salt (Werkzeug-compatible); unknown IDs still get
  a hash comparison → response-time tampering can't enumerate accounts.
- Sessions: random 32-byte tokens; only **SHA-256 digests** stored; TTL enforced;
  password change revokes all sessions immediately.
- **Single session per user**: second login attempt rejected with 409 — no concurrent devices.
- Login throttling: 5 rapid failures = temporary lockout (per user+IP).
- Authorization: `roles_required()` on every protected endpoint; client-side role
  guards are UX only — the server enforces.
- **Answers stored in browser memory only** during exam — sent to DB only on
  submit (all at once) or edit request (individual answer for staff review).
- Grading is **server-side only**; code answers are stored for manual review and
  **never executed** in the backend process.
- **Fullscreen enforcement**: exam content CSS-hidden when not in fullscreen;
  Esc key blocked; auto re-request on exit; violation counter + staff notification.
- **Keyboard blocking**: Ctrl+Tab, Ctrl+W, Ctrl+T, Alt+Tab, F11 all prevented.
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
| **Netlify (recommended)** | Static Vite build + TypeScript Functions | `TURSO_DB_URL`, `TURSO_AUTH_TOKEN` |
| **Render / Railway / Fly.io / VPS** | Flask API (`src/backend`) | `SECRET_KEY`, `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`, `CORS_ORIGINS` |
| **Turso**           | Cloud SQLite (already wired)           | minted DB token |

The recommended setup is **Netlify + Turso** — no separate server needed.
The TypeScript Functions backend talks directly to Turso; the SPA calls
same-origin `/api/*`.