# Fresh Coders 2.0 — Euphoria 2026

University coding assessment platform for the **Department of Freshman Engineering**,
Kalasalingam Academy of Research and Education.

`CODE • COMPETE • CONQUER`

- Event: **Euphoria 2026** — A Techno Management Meet (Theme: Sustainability)
- Date: 26 September 2026 · 9:30 AM – 1:00 PM
- Venue: 11th Block, Room No. 11506 & 11507
- Prize pool ₹15,000 · Registration ₹200 per student · euphoria.kalasalingam.ac.in

---

## 1. Architecture

```
frontend (React + JavaScript/TypeScript + Tailwind CSS)
        │  REST over JSON (Bearer session token)
backend  (Python + Flask)
        │  parameterised SQL
database (SQLite — database/fresh_coders.sqlite)
```

The platform is **event → test → question bank → questions → attempt → answers → result**.
Nothing is hardcoded around a single test: staff create unlimited tests, question counts,
durations and type distributions without touching source code.

### Server authority
The browser is never trusted. The server owns test start, deadline, attempt status, student
lock state, edit permissions, submission state, force stop and the final score. The exam
countdown in the UI is a display of the server deadline only.

### Exam answer state
While answering, the working answers live in React state (`{ questionId: answer }`). There is
no request per keystroke and no database write per keystroke, and answers are never persisted
to localStorage or IndexedDB. Answers reach the server when the student locks a question, on
submit, on time expiry, on force submit, and on force stop.

---

## 2. Repository layout

```
├── App.tsx                     routing + providers
├── pages/                      Landing, Login, student/, staff/, admin/
├── components/                 Button, Modal, DataTable, QuestionCard, ExamTimer, …
├── hooks/useExamAttempt.ts     exam state machine (answers, locks, heartbeat, submit)
├── contexts/AuthContext.tsx    session + current user
├── services/
│   ├── api.ts                  the ONLY HTTP client (Flask contract)
│   ├── evaluation.ts           shared labels + normalisation rules
│   └── server/                 bundled local implementation of the same REST API
├── data/                       event configuration, seed questions, seed accounts
├── utils/                      csv, formatting, class helpers
└── backend/
    ├── app.py                  Flask app factory + blueprints
    ├── config.py               env-driven configuration
    ├── database.py             SQLite connection, audit + security helpers
    ├── auth.py                 PBKDF2 hashing, sessions, role decorators
    ├── grading.py              server-side evaluation
    ├── schema.sql              full SQLite schema (FKs + indexes)
    ├── routes/                 auth, student, staff, admin blueprints
    ├── seed_database.py        development seed data
    └── tests/test_api.py       auth, authorization and exam-flow tests
```

### Frontend ↔ backend switch
`services/api.ts` reads `VITE_API_BASE_URL`.

- **Unset** — requests are served by `services/server/`, a complete in-browser implementation
  of the same REST contract (same routes, same status codes, same authorization rules). This
  is what makes the UI fully clickable in a preview sandbox where no Python process can run.
- **Set** (e.g. `http://localhost:5000`) — every call goes to Flask + SQLite instead. No other
  file changes.

---

## 3. Requirements

- Node.js 18+
- Python 3.10+
- SQLite 3 (bundled with Python)

## 4. Backend setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # then edit the values
export $(grep -v '^#' .env | xargs)                   # or use python-dotenv

python -c "from app import create_app; create_app()"  # creates the schema
python seed_database.py                               # development seed data
python app.py                                         # http://localhost:5000
```

`GET /api/health` should return `{"status":"ok"}`.

## 5. Frontend setup

```bash
npm install
echo "VITE_API_BASE_URL=http://localhost:5000" > .env
npm run dev
```

## 6. Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | backend | Flask secret. Required in production. |
| `DATABASE_PATH` | backend | SQLite file path. |
| `FLASK_ENV` | backend | `development` / `production`. |
| `CORS_ORIGINS` | backend | Comma separated allowed frontend origins. |
| `SESSION_TTL_HOURS` | backend | Session lifetime. |
| `VITE_API_BASE_URL` | frontend | Flask base URL. Unset = bundled local API. |

Never commit `.env`. Production passwords are never hardcoded.

## 7. Development seed accounts

| Role | ID | Password |
| --- | --- | --- |
| Super Admin | `ADMIN001` | `admin@2026` |
| Staff | `STAFF001` | `staff@2026` |
| Student | `ST2026001` | `student@2026` |

Demo data only — rotate every credential before the event.

---

## 8. API

**Auth** — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`,
`POST /api/auth/security-event`, `POST /api/developer/init-super-admin`

**Student** — `GET /api/student/dashboard`, `GET /api/student/tests`,
`GET /api/student/tests/:id`, `POST /api/student/tests/:id/start`,
`GET /api/student/attempts/:id`, `POST /api/student/attempts/:id/lock`,
`POST /api/student/attempts/:id/heartbeat`, `POST /api/student/attempts/:id/submit`,
`POST /api/student/attempts/:id/edit-request`, `GET /api/student/results`

**Staff** — `GET /api/staff/dashboard`, `GET|POST /api/staff/tests`,
`GET|PUT /api/staff/tests/:id`, `POST /api/staff/tests/:id/duplicate|schedule|start|stop|force-stop`

**Questions** — `GET|POST /api/questions`, `GET|PUT|DELETE /api/questions/:id`

**Monitoring** — `GET /api/staff/live`,
`POST /api/staff/students/:id/lock|unlock|force-submit`

**Edit requests** — `GET /api/staff/edit-requests`,
`POST /api/staff/edit-requests/:id/approve|deny`

**Results** — `GET /api/results`, `POST /api/results/publish`

**Admin** — `GET|POST /api/admin/students`, `PUT /api/admin/students/:id`,
`POST /api/admin/students/import`, `GET|POST /api/admin/staff`, `PUT /api/admin/staff/:id`,
`GET|POST /api/admin/events`, `PUT /api/admin/events/:id`, `GET /api/admin/overview`

**Logs** — `GET /api/staff/security-events`, `GET /api/staff/audit-logs`

---

## 9. Roles

| | Developer | Super Admin | Staff | Student |
| --- | --- | --- | --- | --- |
| Initialise Super Admin | ✅ | — | — | — |
| Manage students / staff / events | — | ✅ | — | — |
| Create & control tests, questions | — | ✅ | ✅ | — |
| Monitor, lock, force submit, force stop | — | ✅ | ✅ | — |
| Approve / deny edit requests | — | ✅ | ✅ | — |
| Take tests, request modification | — | — | — | ✅ |

Closed portal: no public signup, no social login. Staff cannot create accounts; a Super Admin
cannot create another Super Admin.

## 10. Testing

```bash
cd backend && pytest
```

Covers login for each role, unauthenticated and cross-role access, cross-student attempt
access, test creation, start gating, answer locking, edit request + approval, submission,
server-side scoring, result publication and CSV import validation.

## 11. Production deployment

1. Set `FLASK_ENV=production` and a strong `SECRET_KEY`.
2. Serve Flask behind gunicorn and a reverse proxy, e.g.
   `gunicorn -w 4 -b 127.0.0.1:5000 app:app` (SQLite runs in WAL mode for concurrency).
3. Build the frontend (`npm run build`) and serve the static bundle from nginx.
4. Restrict `CORS_ORIGINS` to the real frontend origin and terminate TLS at the proxy.
5. Back up `fresh_coders.sqlite` before and after the event.
6. Load test with ~500 concurrent clients before the event; the exam client sends one
   heartbeat every 10s and one write per locked answer, not per keystroke.

## 12. Security notes

- Passwords are hashed with PBKDF2-SHA256 (`werkzeug.security`). Plaintext is never stored.
- Every query is parameterised; role checks run on every protected endpoint.
- Students can only read their own attempts and their own published results.
- Monitoring signals (fullscreen exit, tab visibility, navigation attempts, multiple sessions)
  are recorded for staff review. They are **indicators only** — browser controls do not
  guarantee prevention of misconduct, and the platform never declares cheating automatically.
- Coding questions are stored for sandboxed or manual evaluation. **Arbitrary student code is
  never executed inside the Flask process.** Any future execution must run in an isolated
  container with CPU, memory, filesystem and network limits.
