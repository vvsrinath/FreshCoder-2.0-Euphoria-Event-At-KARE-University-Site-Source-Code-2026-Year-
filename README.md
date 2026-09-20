# Fresh Coders 2.0 — Euphoria 2026 Platform

> **Examination platform for the “Fresh Coders 2.0” event at KARE University — Euphoria 2026**
>
> **Repository:** https://github.com/vvsrinath/FreshCoder-2.0-Euphoria-Event-At-KARE-University-Site-Source-Code-2026-Year  
> **Developed by:** **Srinath Vatchavari Venkateshan** — Full Stack Developer, 1st Year Mechanical Engineering  
> **GitHub:** `vvsrinath` — **Email:** `vvsrinath0@gmail.com` — **Phone:** `+91 94894 25945`

A complete, production-ready examination system with **student exam portal**, **staff live-monitoring panel**, and **admin management console** — built to run a 200+ student coding event in two rooms (11506 & 11507, 11th Block) on **26 September 2026**.

---

## Table of Contents

1. [Overview & Features](#overview--features)
2. [Technology Stack](#technology-stack)
3. [Architecture — How It Works](#architecture--how-it-works)
4. [User Flows (Student / Staff / Admin)](#user-flows)
5. [Database Model](#database-model)
6. [Security Model](#security-model)
7. [Project Structure](#project-structure)
8. [Quick Start (Local Development)](#quick-start)
9. [Demo Credentials](#demo-credentials)
10. [Deployment (Netlify + Turso)](#deployment)
11. [API Reference](#api-reference)
12. [Documentation](#documentation)

---

## Overview & Features

**Fresh Coders 2.0** is the student coding examination of **Euphoria 2026** — the annual techno-management meet of Kalasalingam Academy of Research and Education, hosted by the **Department of Freshman Engineering**.

The platform handles the entire exam lifecycle: question authoring, test assembly, student assignment, timed proctored delivery, live monitoring, grading, and results — all in one codebase.

### Highlights

| Area | What it does |
|------|--------------|
| **Timed exams** | Server-enforced timers, auto-submit on deadline, question set frozen at start |
| **Proctoring** | Fullscreen lock, tab-switch detection, multitask block, weighted risk scores (CLEAR/LOW/MODERATE/HIGH) |
| **Single session** | Students can only be logged in on one device at a time (409 on second device) |
| **Answers in memory** | Answers stay in React state during exam — sent to DB only on submit or edit-request (nothing leaks to staff live view) |
| **Fullscreen lock** | Esc blocked, auto re-request, CSS-hidden content when not fullscreen, staff PIN to unlock |
| **Hidden lock screen** | `z-index: 999999` overlay with `staff PIN` (verified via backend, not hardcoded) on any violation |
| **DevTools block** | F12, Ctrl+Shift+I/J/C, Ctrl+U/S/P blocked in capture phase; window-size + debugger-timing detection every 500ms; auto-submit after 3 violations |
| **Live monitoring** | Staff see violations, heartbeats, and risk scores polling every 8s with pulsing LIVE indicator |
| **Server-side grading** | MCQ, TRUE_FALSE, FILL_BLANK, OUTPUT, CODE, DEBUGGING — scores never accepted from client |
| **Edit requests** | Student → Request modification → Staff Approve/Deny → one-time edit grant |
| **Responsive** | Mobile hamburger, filter bars `w-full sm:w-40`, tables stack, gate allows tablets (768px+) |
| **No server needed for demo** | In-browser mock backend — works on Netlify static hosting with 0 env vars |

---

## Technology Stack

### Frontend — React SPA

| Tech | Version | Purpose |
|------|---------|---------|
| **React** | 18.3 | UI library with hooks and context |
| **TypeScript** | 5.5 | Strict types, typed API client, strict `tsconfig` |
| **Vite** | 5.4 | Build tool — fast dev (`/5173`) and static `dist/` deploy |
| **React Router** | 6.26 | Client routing with `ProtectedRoute` role guards (STUDENT/STAFF/SUPER_ADMIN) |
| **Tailwind CSS** | 3.4 + `tailwind-merge` | Utility styling, responsive (`sm:`, `md:`, `lg:`), dark Navy theme (`#0a1026`) |
| **framer-motion** | 11.5 | Page and transition animations |
| **lucide-react** | 0.522 | Icons (used everywhere) |
| **sonner** | 2.0 | Toast notifications |
| **@emotion/react** | 11.13 | CSS-in-JS for dynamic styles |

**Single API client** — `src/services/api.ts` — identical contract whether it talks to:
1. In-browser mock (`src/services/server/*`) — demo mode, no server
2. TypeScript Netlify Functions (`/.netlify/functions/api`) — production
3. Flask API (`VITE_API_BASE_URL`) — reference/backup

Switches automatically: `VITE_API_BASE_URL` → explicit remote, else `MODE=production` → `/.netlify/functions/api`, else mock.

### Backend — TypeScript Netlify Functions (primary) + Flask 3 (reference)

| Tech | Purpose |
|------|---------|
| **TypeScript Netlify Functions** (`netlify/functions/`) | Single catch-all `api.ts` (`config.path = "/api/*"`), 15 modules, same contract as Flask |
| **Flask 3 + Flask-Cors** (`src/backend/`) | Reference/backup REST API — kept for parity, not used on Netlify |
| **@libsql/client/web** | Turso (libSQL) HTTP client — no native binary, works on Netlify |
| **Turso (libSQL)** | Edge SQLite — 17 tables + 5 views, token-scoped, schema applied on boot |
| **Node `crypto`** | PBKDF2-SHA256 with Werkzeug-compatible hashing (`600k` iterations, SHA-256 digest sessions) |

**Shared backend modules** (both TS and Flask):

| Module | Role |
|--------|------|
| `config` | Env vars (`TURSO_DB_URL`, `TURSO_AUTH_TOKEN`, `SESSION_TTL_HOURS`) — never in code |
| `db` / `database.py` | Parameterised queries, `InValue`/`Row` types, `audit`/`securityEvent` helpers |
| `auth` / `auth.py` | `hashPassword`, `verifyPassword`, `createSession` (SHA-256 token), `requireAuth`, `currentUser` |
| `grading` / `grading.py` | Per-type server-side grading — never executed client code |
| `proctor` / `proctor.py` | Weighted heuristics from `security_events` → risk score + level |
| `reporting` / `reporting.py` | Leaderboard, test snapshot, flag dashboards, CSV builders |
| `export` / `export.py` | Audit log CSV, security events CSV, session purge |
| `router` | Method + regex dispatch, role enforcement (`roles: []` public, `null` any-auth, `["STAFF"]` etc.) |

### Database — Turso (libSQL) / SQLite

- **17 tables:** `users`, `events`, `tests`, `questions`, `question_versions`, `test_questions`, `student_test_assignments`, `attempts`, `frozen_questions`, `answers`, `edit_requests`, `results`, `security_events`, `audit_logs`, `sessions`, `timing_changes` (+ `sqlite_sequence`)
- **5 views:** `v_result_summary`, `v_leaderboard`, `v_test_snapshot`, `v_question_usage`, `v_timing_audit`
- **Roles:** `DEVELOPER`, `SUPER_ADMIN`, `STAFF`, `STUDENT`
- **Key design:** `frozen_questions` snapshots question content at attempt start → mid-test key fix never re-grades in-flight attempts; `attempts` has `UNIQUE(test_id, student_id)`; timers server-enforced.

For full schema, see `src/backend/schema.sql` and `docs/TECHNICAL-DOCUMENTATION.md §5`.

---

## Architecture — How It Works

```
Browser (React SPA)
 │
 ├─ Production (Netlify)  →  /.netlify/functions/api/*  →  Netlify Functions (TypeScript)
 │                                                        │
 │                                                        └─ @libsql/client/web  →  Turso (libSQL) cloud DB
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

**Dual-backend contract:** Frontend talks to **one endpoint contract**. Every route the TS/Flask backend enforces (auth, authorization, deadlines, attempt state, grading) is mirrored by `src/services/server/*` so the demo behaves identically and the client is never the authority. Same build works in all three modes.

### Request flow — login

```
POST /api/auth/login  { userId, password, portal }
  → verifyPassword (PBKDF2-SHA256, constant-time)
  → check single-session for STUDENT (409 if already logged in)
  → createSession → token (SHA-256 stored, TTL 8h)
  → security_event(LOGIN_SUCCESS) + audit
  → { token, user }
```

### Request flow — student exam

```
1. POST /api/student/tests/:id/start → create attempt, freeze questions, set deadline
2. Browser enters fullscreen automatically
3. During exam: heartbeats + monitoring events → security_events table
   Answers stay in React state only (not in DB)
4. “Lock & Next” → answer locked in local state only
5. “Request modification” → that answer sent to DB + edit_request row → staff reviews
6. POST /api/student/attempts/:id/submit → all answers sent at once → server grades (grading.ts) → result stored
7. POST /api/student/attempts/:id/verify-pin → staff PIN (password) verified via verifyPassword → unlock overlay + re-fullscreen
```

### Proctoring & fullscreen

- **Auto-fullscreen** on start, **CSS-hidden** (`invisible h-0`) when not fullscreen, **blocking overlay** (`z-index: 999999`, `rgba(15,23,42,0.98)`, `100vw/100vh`) covers 100% of screen
- **Hidden lock screen** (`#lockout-screen` + `.hidden` toggle) — staff PIN input, backend-verified (not hardcoded), `Unlock & Resume` re-forces fullscreen
- **Blur / visibility / pagehide / hasFocus polling (700ms) / resize** — any focus loss or multitask → instant `fullscreenBlocked` + violation
- **Keyboard** — F1-F12, Ctrl+Tab/W/T/N/R, Ctrl+Shift+I/J/C, Ctrl+U/S/P, Alt+Tab, PrintScreen all blocked in **capture phase** (`stopImmediatePropagation`)
- **DevTools** — window-size diff (>150px) + debugger-timing (>80ms) every 500ms → `devtoolsOpen` overlay, **auto-submit after 3 detections**
- **Clipboard** — `copy/cut/paste/dragstart/selectstart/contextmenu` all blocked; `user-select: none` on `.secure-zone` (inputs allow `text`), violations logged to `security_events`

### Answers in memory

- `useExamAttempt` `answers: Record<string,string>` lives in React only
- `lockAnswer` → local state only (no API)
- `requestEdit` → sends that single `value` + reason to DB for staff review
- `submit` → sends **all** `answers` at once, server grades and stores

### Staff live monitoring

- Polls `GET /api/staff/live` every 8s (LiveMonitoring) / 10s (EditRequests) / 15s (StaffDashboard)
- Pulsing green dot + `LIVE` badge + `Last updated` time
- `proctor.ts` weights: `TAB_VISIBILITY_CHANGE`, `FULLSCREEN_EXIT`, `WINDOW_BLUR`, `FOCUS_LOST`, `NAVIGATION_ATTEMPT`, `DEVTOOLS_ATTEMPT` + burst detection → `CLEAR/LOW/MODERATE/HIGH`

---

## User Flows

### Student

```
Login (portal=STUDENT) → Dashboard (assigned tests, progress) → Instructions
→ WaitingRoom (polls test status) → Start → Exam (fullscreen, violations counted)
→ Submit → Results (if published)
```

### Staff

```
Login (portal=STAFF) → Dashboard (stats, 15s poll) → Test Management (CRUD, start/stop, duplicate, schedule)
→ Question Bank (4-col simplified: Question + Category, 3 filters: Type/Level/Search)
→ Live Monitoring (LIVE dot, 8s poll, lock/unlock/force-submit per student)
→ Edit Requests (approve/deny) → Results → Security Events / Audit Logs (CSV)
```

### Admin (Super Admin)

```
Login (portal=ADMIN) → Overview (stats, recent audit, security events)
→ Student Management (import CSV up to 5000 rows, create/edit, active/inactive, password reset)
→ Staff Management (Add staff — only name required, ID auto-generates STAFF003, password defaults staff@2026)
→ Event Management (CRUD events)
```

---

## Database Model

**Tables (17):**

| Table | Purpose |
|-------|---------|
| `users` | `id` (PK, upper-cased), `role`, `name`, `email`, `password_hash` (Werkzeug PBKDF2), `active`, `created_at` |
| `events` | Event row (`Euphoria 2026`, theme, venue, prize, site) |
| `tests` | `selection_mode` (MANUAL/DISTRIBUTION), `question_count`, `duration_minutes`, `scheduled_start`, `status` (DRAFT→SCHEDULED→ACTIVE→COMPLETED→ARCHIVED) |
| `questions` | `type`, `topic`, `difficulty`, `marks`, `prompt`, `code`, `options` (JSON), `version`, `status` |
| `question_versions` | Immutable history on edit |
| `test_questions` | Join for MANUAL mode |
| `student_test_assignments` | Gating: if rows exist for a test, only assigned students may take it |
| `attempts` | `test_id, student_id` unique, `status` (IN_PROGRESS/SUBMITTED etc.), `question_ids` (JSON), `deadline`, `current_question`, `session_token`, `locked_by_staff` |
| `frozen_questions` | Snapshot per attempt |
| `answers` | `attempt_id, question_id`, `value`, `locked`, `edit_granted` |
| `edit_requests` | `question_id, current_answer, reason, status` (PENDING/APPROVED/DENIED) |
| `results` | Denormalised after grading, `breakdown` JSON, `published` flag |
| `security_events` | `type, actor, role, test_id, attempt_id, detail, created_at` |
| `audit_logs` | Actor, role, action, target, metadata |
| `sessions` | `token` (SHA-256 PK), `user_id`, `role`, `created_at`, `expires_at` |
| `timing_changes` | Record of `scheduled_start` edits |

**Views:** `v_result_summary`, `v_leaderboard`, `v_test_snapshot`, `v_question_usage`, `v_timing_audit`.

See `src/backend/schema.sql` for DDL and indexes.

---

## Security Model

| Concern | How it's handled |
|---------|------------------|
| **Passwords** | PBKDF2-SHA256, 600k iterations, per-user 16-char salt, Werkzeug-compatible; unknown IDs still get dummy-hash compare (no enumeration) |
| **Sessions** | 32-byte random `base64url` token, only SHA-256 stored, TTL 8h, `currentUser` checks expiry and `active` flag |
| **Single session** | STUDENT only: `SELECT COUNT(*) FROM sessions WHERE user_id` → 409 if >0; Staff/Admin allow multi-device |
| **Throttling** | In-memory per `userId|ip`, `loginWindowMinutes` (15) / `loginMaxAttempts` (5) → 429 |
| **Authorization** | `requireAuth` + `roles` per route; `ProtectedRoute` is UX only, server enforces |
| **Answers** | Browser memory only until submit/edit-request; grading server-only, code never executed |
| **Fullscreen** | Esc blocked, content hidden when not fullscreen, overlay `z-index: 999999`, auto re-request |
| **Clipboard** | `copy/cut/paste/dragstart/selectstart/contextmenu` blocked in capture phase, `user-select: none` except `input/textarea` |
| **DevTools** | F12 etc. blocked, window-size + debugger-timing detection every 500ms, auto-submit after 3 |
| **SQL** | 100% parameterised (`?` placeholders) |
| **Secrets** | `.env`-driven, never committed, `.gitignore` covers `.env*`, `SECRETS_SCAN_ENABLED=false` for docs placeholders |

---

## Project Structure

```
src/
  components/       Card, PortalLayout, UniversityMark, GlobalFooter, BrandMark,
                    Button, TextField, DataTable, StatCard, QuestionCard,
                    QuestionNavigator, ExamTimer, Modal, ConfirmDialog,
                    LoadingState, ErrorState, EmptyState, DesktopOnlyGate
  pages/
    Landing, Login, Developers, Convenors, NotFound
    student/        StudentDashboard, MyTests, Instructions, WaitingRoom,
                    Exam, StudentResults, StudentExtras
    staff/          StaffDashboard, TestManagement, TestBuilder, QuestionBank,
                    QuestionEditor, LiveMonitoring, StaffResults, EditRequests,
                    SecurityEvents, AuditLogs, StaffExtras
    admin/          AdminDashboard, StudentManagement, StaffManagement, EventManagement
  hooks/            useExamAttempt.ts (exam state + all proctoring)
  contexts/         AuthContext, ProtectedRoute
  services/
    api.ts          Single client (VITE_API_BASE_URL → /.netlify/functions/api → mock)
    server/         In-browser mock backend (mirrors Flask/Functions contract)
    db.ts           Mock DB helpers
  data/             eventConfig (brand, eventConfig, team, convenors, guidelines)
  utils/            cn, format (titleCase, relativeTime, formatDateTime)
  backend/          Flask 3 reference — config, database, auth, grading, proctor,
                    reporting, export, cli, schema.sql, routes/*, seed_database.py
  types/            Shared TypeScript types

netlify/
  functions/
    api.ts          Catch-all entry (config.path = "/api/*", lazy imports → no 502)
    lib/
      config, db, http, auth, grading, proctor, reporting, export, router, utils
      routes/       auth, student, staff, admin (all with verify-pin, lock, etc.)

public/             kare-emblem.png, kare-university-banner.png, landing-hero.jpg, etc.
docs/               TECHNICAL-DOCUMENTATION.md, DEPLOYMENT.md
```

---

## Quick Start

```bash
# Frontend (repo root)
npm install
npm run dev            # http://localhost:5173 — demo mode, no server needed

# Backend (optional, for reference)
python3 -m venv .venv && source .venv/bin/activate
pip install -r src/backend/requirements.txt
cp src/backend/.env.example src/backend/.env   # add TURSO_DB_URL + TURSO_AUTH_TOKEN to use Turso
python src/backend/app.py          # http://localhost:5000/api/health

# Point frontend at real API (root .env)
VITE_API_BASE_URL=http://localhost:5000
```

**Tests** (always local SQLite, never cloud DB):

```bash
cd src/backend && pytest        # 23 passed
```

**Build:**

```bash
npm run build            # Vite build → dist/ (static) + Netlify Functions bundle
```

---

## Demo Credentials

| Role | User ID | Password |
|------|---------|----------|
| Developer | `DEV001` | `dev@2026` |
| Super Admin | `ADMIN001` | `admin@2026` |
| Staff | `STAFF001` | `staff@2026` |
| Staff | `STAFF002` | `staff@2026` |
| Student | `ST2026001`–`ST2026005` | `student@2026` |

> Change all passwords before production. Seed via `python src/backend/seed_database.py` (idempotent).

---

## Deployment

**Recommended: Netlify + Turso (no separate server)**

1. Push to GitHub `main` → Netlify auto-deploys
2. Netlify dashboard → Site configuration → Environment variables (scope: **All scopes**):
   ```
   TURSO_DB_URL=libsql://fresh-coder-euphoria-at-kare-university-2026-vvsrinath0.aws-ap-south-1.turso.io
   TURSO_AUTH_TOKEN=eyJhbG... (full JWT)
   ```
3. Deploys → Trigger deploy → wait for green Published
4. Verify: `https://YOUR-SITE.netlify.app/.netlify/functions/api/health` → `{"status":"ok","tursoUrlSet":true}`

**`netlify.toml`:**

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"
[build.environment]
  NODE_VERSION = "20"
  SECRETS_SCAN_ENABLED = "false"
[functions]
  node_bundler = "esbuild"
  external_node_modules = ["@libsql/client","libsql"]
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200  # SPA fallback — does NOT intercept /.netlify/functions/*
```

- **Frontend** calls `/.netlify/functions/api/*` directly (bypasses redirect)
- **Health** `GET /api/health` → `ok` + `tursoUrlSet`
- **Why `@libsql/client/web`?** HTTP-only, no native Linux binary (`@libsql/linux-x64-gnu`) → avoids `502 Runtime.ImportModuleError`

For Flask host (Render/Railway/Fly), see `docs/DEPLOYMENT.md` and `netlify.env.example`. Turso DB already seeded.

---

## API Reference

**Auth**

| Method | Path | Auth | Body | Notes |
|--------|------|------|------|-------|
| `POST` | `/api/auth/login` | — | `{ userId, password, portal }` | `portal`: ADMIN/STUDENT/STAFF, 409 if student already logged in |
| `POST` | `/api/auth/logout` | any | — | Deletes session |
| `GET` | `/api/auth/me` | any | — | Current user |
| `POST` | `/api/auth/security-event` | any | `{ type, detail, attemptId? }` | `type` in `MONITORING_EVENTS` |

**Student** (`STUDENT` only)

| Path | Notes |
|------|-------|
| `GET /api/student/dashboard` | Assigned tests + results |
| `GET /api/student/tests/:id` | Single test |
| `POST /api/student/tests/:id/start` | Create/freeze attempt |
| `GET /api/student/attempts/:id` | Poll attempt |
| `POST /api/student/attempts/:id/heartbeat` | `{ currentQuestion, answeredCount }` |
| `POST /api/student/attempts/:id/verify-pin` | `{ pin }` — staff password verified via `verifyPassword`, unlocks lock screen |
| `POST /api/student/attempts/:id/edit-request` | `{ questionId, reason, value }` |
| `POST /api/student/attempts/:id/submit` | `{ answers: Record<string,string>, reason }` |

**Staff** (`STAFF` only) — `GET /api/staff/live` (8s poll), `POST /api/staff/students/:id/lock`, `unlock`, `force-submit`, `GET /api/staff/edit-requests`, `POST .../approve`, `deny`, `GET /api/questions`, `POST /api/questions`, etc.

**Admin** (`SUPER_ADMIN` only) — `GET /api/admin/overview`, `GET/POST /api/admin/students`, `PUT /api/admin/students/:id`, `POST /api/admin/students/import`, `GET/POST /api/admin/staff`, `GET/POST /api/admin/events`, etc.

All responses are `{ ... }` JSON with `message` on error. See `netlify/functions/lib/routes/*.ts` for full list.

---

## Documentation

- **[Complete Technical Documentation](docs/TECHNICAL-DOCUMENTATION.md)** — deep dive: tech stack table, architecture diagram, runtime flows, data model, module map, security decisions
- **[Deployment Guide](docs/DEPLOYMENT.md)** — Netlify (recommended), Flask hosts, Turso setup, maintenance, tests
- **`netlify.env.example`** — every env var documented (placeholders)
- **`src/backend/.env.example`** — local Flask env

---

## Credits

**Developed by Srinath Vatchavari Venkateshan** — 1st Year, Mechanical Engineering, KARE University  
Faculty Mentor: **Sivasubbramaniyan L** — Assistant Professor, CSE, KARE  
**GitHub:** https://github.com/vvsrinath — **Email:** vvsrinath0@gmail.com — **Phone:** +91 94894 25945

Built for **Euphoria 2026** — Department of Freshman Engineering, Kalasalingam Academy of Research and Education (Deemed to be University).

