# Fresh Coders 2.0 — Euphoria 2026 Platform

Examination platform for the "Fresh Coders 2.0" event at **KARE University –
Euphoria 2026**: student exam portal, staff monitoring panel, and admin management.

> Repository: https://github.com/vvsrinath/FreshCoder-2.0-Euphoria-Event-At-KARE-University-Site-Source-Code-2026-Year
> Developer / creator / contributor: **vvsrinath** (`vvsrinath0@gmail.com`)

## Documentation

- [Complete Technical Documentation](docs/TECHNICAL-DOCUMENTATION.md) —
  architecture, tech stack, how everything works, data model, security approach.
- [Deployment Guide (all targets)](docs/DEPLOYMENT.md) — Netlify, Turso,
  Render / Railway / Fly.io / VPS, maintenance & tests.
- [Netlify environment template](netlify.env.example) — every variable documented.

## Quick start

1. `npm install`
2. `npm run dev` → http://localhost:5173

The app works out of the box using the bundled **in-browser demo backend**
(`src/services/server`) — no server needed. Point `VITE_API_BASE_URL` at the
Flask API (see docs) to use the real backend backed by the Turso cloud database.

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
  contexts/        AuthContext, ProtectedRoute (role guards)
  backend/         Flask 3 API — config, database, routes/*, grading, proctor,
                   reporting, export, cli, seed, schema.sql, tests/
```