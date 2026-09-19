# Fresh Coders 2.0 — Euphoria 2026 Platform

Examination platform for the "Fresh Coders 2.0" event at **KARE University –
Euphoria 2026**: student exam portal, staff monitoring panel, and admin management.

> Repository: https://github.com/vvsrinath/FreshCoder-2.0-Euphoria-Event-At-KARE-University-Site-Source-Code-2026-Year
> Developer / creator / contributor: **vvsrinath** (`vvsrinath0@gmail.com`)

## Architecture

```
Netlify (production)
├── Frontend: Vite React SPA → static dist/
├── Backend:  TypeScript Netlify Functions → netlify/functions/api.ts
└── Database: Turso (libSQL) cloud
```

- **No separate server needed** — runs entirely on Netlify + Turso
- Answers stored in **browser memory only** during exam (sent to DB on submit/edit)
- **Fullscreen locked** — student cannot exit until re-entering or staff approval
- **Single session per user** — second login attempt blocked

## Documentation

- [Complete Technical Documentation](docs/TECHNICAL-DOCUMENTATION.md) —
  architecture, tech stack, how everything works, data model, security approach.
- [Deployment Guide (all targets)](docs/DEPLOYMENT.md) — Netlify (recommended),
  Render / Railway / Fly.io / VPS, maintenance & tests.
- [Netlify environment template](netlify.env.example) — every variable documented.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
```

The app works out of the box using the bundled **in-browser demo backend**
(`src/services/server`) — no server needed. In production on Netlify, the SPA
calls same-origin `/api/*` which routes to the TypeScript Functions backend.

## Demo credentials

| Role        | User ID    | Password     |
|-------------|------------|--------------|
| Developer   | `DEV001`   | `dev@2026`   |
| Super Admin | `ADMIN001` | `admin@2026` |
| Staff       | `STAFF001` | `staff@2026` |
| Staff       | `STAFF002` | `staff@2026` |
| Student     | `ST2026001`–`ST2026005` | `student@2026` |

> Change all passwords before production.

## Structure

```
src/
  services/        api.ts (single client), server/* (in-browser mock backend), db.ts
  pages/           student/ | staff/ | admin/ | Landing, Login, Developers, Convenors
  hooks/           useExamAttempt.ts (exam state + proctoring enforcement)
  contexts/        AuthContext, ProtectedRoute (role guards)
  backend/         Flask 3 API (reference/backup) — config, database, routes/*, grading, proctor

netlify/
  functions/       TypeScript Netlify Functions backend
    api.ts         Catch-all entry (config.path = "/api/*")
    lib/           Shared modules: config, db, http, auth, grading, proctor, reporting, export, router
    lib/routes/    Route handlers: auth, student, staff, admin
```

## Key features

- **Fullscreen enforcement** — exam content hidden when not in fullscreen, Esc blocked, auto re-request
- **Single session** — can't login on two devices simultaneously
- **Answers in memory only** — nothing sent to DB until submit or edit request
- **Live monitoring** — staff see violations in real-time (polls every 8s)
- **Risk scoring** — weighted heuristics from security events (CLEAR/LOW/MODERATE/HIGH)
- **Server-side grading** — scores never accepted from the client
- **Edit request flow** — student requests, staff approves/denies, answer sent to DB for review
