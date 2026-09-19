# Fresh Coders 2.0 — Euphoria 2026 Platform

Examination platform for the "Fresh Coders 2.0" event at Euphoria 2026:
student exam portal, staff monitoring panel, and admin management.

## Getting Started

1. Run `npm install`
2. Run `npm run dev`

The app works out of the box using the bundled in-browser demo backend
(`src/services/server`), seeded with demo accounts — no server needed for a demo.

## Demo credentials

| Role          | User ID    | Password     |
|---------------|------------|--------------|
| Developer     | `DEV001`   | `dev@2026`   |
| Super Admin   | `ADMIN001` | `admin@2026` |
| Staff         | `STAFF001` | `staff@2026` |
| Staff         | `STAFF002` | `staff@2026` |
| Student       | `ST2026001`–`ST2026005` | `student@2026` |

## Deploying to Netlify

The frontend is a static Vite build and deploys to Netlify as-is:

1. Push this folder (the one containing `package.json`) to a GitHub/GitLab repo.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Netlify auto-detects the settings from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 20
4. Deploy. Deep links (`/student`, `/staff`, …) work on refresh thanks to the
   `_redirects` SPA fallback.

This demo deploy runs the in-browser mock backend. To connect the real
Flask + SQLite API instead:

1. Host `src/backend` on any serverless/VM host that supports Python
   (Render, Railway, Fly.io, …) and run `python seed_database.py` once.
2. Add a Netlify environment variable `VITE_API_BASE_URL` pointing at the
   hosted API (e.g. `https://your-api.onrender.com`) and redeploy.