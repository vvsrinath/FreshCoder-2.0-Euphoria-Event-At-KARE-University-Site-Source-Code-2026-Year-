# Fresh Coders 2.0 — Euphoria 2026 : Deployment Guide (all targets)

This guide covers every way the platform can run, from a zero-server demo to the
full Flask + Turso stack. Order of effort: **Netlify (demo) → Turso DB →
Flask API host → connect them**.

---

## 0. Environments & secrets (netlify.env.example + .env.netlify)

Real secret values are stored in the **gitignored** files:
- `.env.netlify` (repo root) — everything you paste into dashboards
- `src/backend/.env` — local/backend Flask config

The committed template `netlify.env.example` documents every variable (placeholders).
**Never commit real tokens.** Secrets live only in platform dashboards.

| Variable            | Where it lives              | Purpose |
|---------------------|-----------------------------|---------|
| `VITE_API_BASE_URL` | Netlify                     | Point the SPA at the hosted Flask API (empty = demo mode) |
| `SECRET_KEY`        | Backend host                | Flask session/signing key (random string) |
| `FLASK_ENV`         | Backend host                | `production` on live hosts |
| `CORS_ORIGINS`      | Backend host                | Comma-separated allowed site origins |
| `TURSO_DB_URL`      | Backend host                | libsql URL of the Turso database |
| `TURSO_AUTH_TOKEN`  | Backend host                | DB-scoped token minted for that database |
| `DATABASE_PATH`     | Backend host (optional)     | Local SQLite fallback path |
| `SESSION_TTL_HOURS` | Backend host (optional)     | Session lifetime (default 8) |

---

## 1. Deploy the frontend → Netlify (static, works with NO backend)

The Vite build is fully static. When `VITE_API_BASE_URL` is empty the app runs the
bundled **in-browser demo backend** — zero servers required.

1. Push this repo to GitHub (done — owned by `vvsrinath`).
2. Netlify → **Add new site → Import an existing project** → select the repo.
3. Netlify auto-detects from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `20`
4. Add environment variable `VITE_API_BASE_URL` if you want the real backend
   (leave empty for demo).
5. Deploy. SPA deep links work on refresh via `public/_redirects`.

> Optional: you can also just drag-and-drop the `dist/` folder after a local
> `npm run build` — Netlify Drop. (Images in `public/` are bundled automatically.)

---

## 2. Provision the Turso database (done — but reproducible)

The DB is already created and wired:
- Org `vvsrinath0`, group `default`
- Database `fresh-coder-euphoria-at-kare-university-2026`
  (host `fresh-coder-euphoria-at-kare-university-2026-vvsrinath0.aws-ap-south-1.turso.io`)
- Schema applied (17 tables + 5 views) and seeded with demo data by the backend.

Reproduce anywhere:
```bash
# (Turso CLI) create a DB in a group, then mint a DB-scoped token
turso db create fresh-coder-euphoria-at-kare-university-2026 --group default
turso db tokens create fresh-coder-euphoria-at-kare-university-2026   # → token
# Schema + seed are applied automatically on first backend boot.
```

---

## 3. Host the Flask API

Netlify does **not** run Python. Put `src/backend` on any Python host.
The backend auto-applies the schema to Turso on first boot, then you seed once.

### Render (easiest)
1. New **Web Service** ← GitHub repo (or sub-path `src/backend`).
2. Runtime: **Python 3**.
3. Build: `pip install -r src/backend/requirements.txt` + install libsql
   (`python -m pip install "libsql-experimental>=0.10"`).
4. Start: `gunicorn --chdir src/backend app:app --bind 0.0.0.0:$PORT` — or
   `gunicorn app:app --chdir /opt/render/project/src/src/backend`.
5. Environment variables: the backend block from §0 (`SECRET_KEY`,
   `FLASK_ENV=production`, `CORS_ORIGINS=https://<your-site>.netlify.app`,
   `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`).
6. After first deploy run once: `python src/backend/seed_database.py`
   (or via a one-off shell) to create demo accounts.

### Railway / Fly.io / VPS
- **Railway**: same as Render (gunicorn + env vars; add a one-off `seed_database.py`).
- **Fly.io**: `fly launch` with a `Procfile` → `web: gunicorn app:app -b 0.0.0.0:8080`
  (working dir `src/backend`), secrets via `fly secrets set`.
- **VPS**: `pip install -r src/backend/requirements.txt`,
  `gunicorn --chdir src/backend app:app`, put it behind nginx/Caddy + HTTPS.

> The backend needs the `libsql` Python package only when `TURSO_DB_URL` is set.
> Add it to `requirements.txt` or install at build time (Gunicorn/tail workers
> depend on the platform).

---

## 4. Connect the frontend → live API

1. In Netlify set `VITE_API_BASE_URL` to your hosted Flask base
   (e.g. `https://fresh-coders-api.onrender.com`) — no trailing slash.
2. Set that same URL in the backend's `CORS_ORIGINS` (in addition to the
   Netlify site URL).
3. Redeploy Netlify. The SPA now sends every `/api/...` request to the real
   Flask API, which reads/writes the Turso database.

**Demo ⇄ live switch** is just that one variable + redeploy. The API client
contract (`src/services/api.ts`) is identical in both modes.

---

## 5. Maintenance (backup / exports)

Run from `src/backend`:
```bash
python cli.py backup --output euphoria-backup.sqlite   # full snapshot (works with Turso)
python cli.py export-audit-logs --output audit.csv     # audit trail
python cli.py export-security-events --output sec.csv  # security events
python cli.py purge-sessions                            # clean expired sessions
```

---

## 6. Tests

```bash
cd src/backend && pytest          # 23 tests, always against a temporary local DB
```

---

## 7. Repository access control

- Repo created under GitHub account **vvsrinath** (Srinath Vatchavari Venkateshan,
  `vvsrinath0@gmail.com`) — developer, creator and the **only** collaborator/owner.
- Git author identity is set to `vvsrinath <vvsrinath0@gmail.com>` for all commits.
- No other user is invited; keep it that way via
  **Settings → Collaborators & teams**.