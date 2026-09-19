# Fresh Coders 2.0 — Euphoria 2026 : Deployment Guide (all targets)

This guide covers every way the platform can run, from a zero-server demo to the
full production setup. **Recommended path: Netlify (frontend + TS functions + Turso).**

---

## 0. Environments & secrets

Real secret values are stored in **gitignored** files:
- `.env.netlify` (repo root) — everything you paste into dashboards
- `src/backend/.env` — local/backend Flask config

The committed template `netlify.env.example` documents every variable (placeholders).
**Never commit real tokens.** Secrets live only in platform dashboards.

| Variable            | Where it lives              | Purpose |
|---------------------|-----------------------------|---------|
| `TURSO_DB_URL`      | Netlify Functions env       | libsql URL of the Turso database |
| `TURSO_AUTH_TOKEN`  | Netlify Functions env       | DB-scoped token for Turso |
| `VITE_API_BASE_URL` | Netlify (optional)          | Override API base; empty = same-origin `/api` (production default) |

---

## 1. Deploy to Netlify (frontend + TypeScript backend)

The platform now runs entirely on Netlify:
- **Frontend**: Vite React SPA → static `dist/`
- **Backend**: TypeScript Netlify Functions → `netlify/functions/api.ts` catch-all
- **Database**: Turso (libSQL) hosted in the cloud

### Setup
1. Push this repo to GitHub (done — owned by `vvsrinath`).
2. Netlify → **Add new site → Import an existing project** → select the repo.
3. Netlify auto-detects from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - Node version: `20`
4. In **Site settings → Environment variables**, add:
   - `TURSO_DB_URL` = `libsql://fresh-coder-euphoria-at-kare-university-2026-vvsrinath0.aws-ap-south-1.turso.io`
   - `TURSO_AUTH_TOKEN` = (your Turso DB-scoped token)
5. Deploy. The SPA calls `/api/*` same-origin; Netlify Functions handle every request.

> **No CORS configuration needed** — the SPA and API share the same domain.

### How it works
- `netlify/functions/api.ts` is a single catch-all function with `config.path = "/api/*"`.
- All routes (auth, student, staff, admin) are bundled into this function via esbuild.
- The function reads `TURSO_DB_URL` and `TURSO_AUTH_TOKEN` from environment variables.
- SPA deep links work on refresh via the `[[redirects]]` fallback in `netlify.toml`.

---

## 2. Provision the Turso database (done — but reproducible)

The DB is already created and wired:
- Org `vvsrinath0`, group `default`
- Database `fresh-coder-euphoria-at-kare-university-2026`
  (host `fresh-coder-euphoria-at-kare-university-2026-vvsrinath0.aws-ap-south-1.turso.io`)
- Schema applied (17 tables + 5 views) and seeded with demo data.

Reproduce anywhere:
```bash
# (Turso CLI) create a DB in a group, then mint a DB-scoped token
turso db create fresh-coder-euphoria-at-kare-university-2026 --group default
turso db tokens create fresh-coder-euphoria-at-kare-university-2026   # → token
# Schema + seed are applied automatically on first backend boot.
```

---

## 3. (Optional) Host the Flask API separately

If you prefer the Python backend on a separate host (Render, Railway, etc.):

1. Set `VITE_API_BASE_URL` in Netlify to your hosted Flask base
   (e.g. `https://fresh-coders-api.onrender.com`).
2. Set that same URL in the backend's `CORS_ORIGINS`.
3. Redeploy Netlify. The SPA now sends every `/api/...` to the Flask API.

**Demo ⇄ live switch** is just that one variable + redeploy. The API client
contract (`src/services/api.ts`) is identical in both modes.

---

## 4. Maintenance (backup / exports)

Run from `src/backend`:
```bash
python cli.py backup --output euphoria-backup.sqlite   # full snapshot (works with Turso)
python cli.py export-audit-logs --output audit.csv     # audit trail
python cli.py export-security-events --output sec.csv  # security events
python cli.py purge-sessions                            # clean expired sessions
```

---

## 5. Tests

```bash
# Python backend tests (23 tests, temporary local DB)
cd src/backend && pytest

# TypeScript function typecheck
npx tsc -p tsconfig.functions.json --noEmit

# TypeScript function bundle (for smoke testing)
node_modules/.bin/esbuild netlify/functions/api.ts --bundle --platform=node --format=esm --external:@libsql/client --outfile=netlify/.smoke/api.mjs
```

---

## 6. Repository access control

- Repo created under GitHub account **vvsrinath** (Srinath Vatchavari Venkateshan,
  `vvsrinath0@gmail.com`) — developer, creator and the **only** collaborator/owner.
- Git author identity is set to `vvsrinath <vvsrinath0@gmail.com>` for all commits.
- No other user is invited; keep it that way via
  **Settings → Collaborators & teams**.
