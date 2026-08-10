# Simplifix Backend

FastAPI + PostgreSQL backend for Simplifix. Provides authentication and CRUD APIs for apartments,
users, categories, private maintenance tickets, public services, manager notices, history,
comments, and notifications, matching the
domain model already used by the [frontend](../frontend).

## Tech Stack

- FastAPI
- PostgreSQL
- SQLAlchemy 2.0 (ORM)
- Alembic (migrations)
- JWT auth via `python-jose` + `passlib`/`bcrypt`

## Project Structure

```text
backend/
├─ app/
│  ├─ core/            # settings, security (hashing, JWT)
│  ├─ db/              # engine/session, declarative base
│  ├─ models/           # SQLAlchemy models
│  ├─ schemas/          # Pydantic request/response models
│  ├─ api/
│  │  ├─ deps.py        # auth dependencies (get_current_user, require_roles)
│  │  └─ v1/
│  │     ├─ api.py      # router aggregator
│  │     └─ endpoints/  # auth, users, apartments, tickets, notices, AI, and notifications
│  └─ main.py           # FastAPI app entrypoint
├─ alembic/             # migrations (env.py + versions/)
├─ scripts/
│  ├─ seed_categories.py
│  └─ generate_api_report.py   # OpenAPI-vs-tests validation report (see below)
├─ tests/               # pytest suite (see Testing below)
├─ openapi.yaml         # generated - see API Validation Report
├─ reports/              # generated - see API Validation Report
├─ requirements.txt
├─ requirements-dev.txt # requirements.txt + pytest/httpx, for running the test suite
├─ pytest.ini
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml   # local dev only
├─ SETUP.md
├─ S3_SETUP.md
└─ RENDER_DEPLOY.md
```

## Setup

New to this project, or don't have Docker/PostgreSQL installed yet? Follow
**[SETUP.md](./SETUP.md)** — it walks through installing Docker (or PostgreSQL natively) from
scratch and getting the API running.

If your environment is already set up, the short version:

```bash
cd backend
cp .env.example .env
docker compose up --build
docker compose exec api python -m scripts.seed_categories   # one-time
docker compose exec api python -m scripts.seed_demo_users
docker compose exec api python -m scripts.seed_demo_services
```

API docs are then available at http://localhost:8000/docs.

## AI features

Complaint analysis, resident chat, manager notice drafting, dashboard summaries, and public-report
duplicate detection can use Google Gemini directly or the AI Pipe Gemini-compatible proxy. Select
one in `backend/.env` (credentials must never be placed in the frontend):

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-3.5-flash

# Or use AI Pipe:
# AI_PROVIDER=aipipe
# AIPIPE_TOKEN=your-token-here
# AIPIPE_MODEL=gemini-2.5-flash-lite
```

Recreate the API container after changing providers so it reloads `.env`:
`docker compose up -d --force-recreate api`.

The API rate-limits complaint analysis to 6 requests/minute, resident chat to 15 requests/minute,
and manager notice drafting to 8 requests/minute per client. Notice drafting sends the manager's
brief and selected tower names to the configured AI provider, then returns an editable title and
message; the provider never sends a notice itself.

New public reports are also compared with recent unresolved public services. Scores strictly above
`PUBLIC_SIMILARITY_THRESHOLD` (default `0.80`) create an employee review suggestion and
notification. AI never merges reports automatically: an employee must accept or decline the popup.
An accepted suggestion creates a new public service page containing every contributing report.

**On model availability**: Google has restricted some model variants (e.g. `gemini-2.5-flash-lite`)
from new users/projects even though they still appear in the API's `ListModels` response — the
only reliable way to confirm a model actually works for *your* key is to call it directly:
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent" \
  -H "Content-Type: application/json" -H "x-goog-api-key: <your key>" \
  -d '{"contents":[{"role":"user","parts":[{"text":"say hello"}]}]}'
```
If the selected model starts returning an AI-related `503`, inspect the API logs for the provider's
status and message. The backend deliberately keeps detailed provider errors server-side so tokens
and internal request data are never returned to clients.

## Migrations

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

The initial migration (`alembic/versions/`) already creates all tables described below.

## Data Model

| Table            | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------- |
| `apartments`      | Unit/building records residents belong to                          |
| `users`           | All four roles (resident, facility_employee, maintenance_staff, facility_manager) in one table, with role-specific nullable columns |
| `categories`      | Fixed complaint categories (plumbing, electrical, etc.)             |
| `tickets`         | Core complaint/ticket record                                       |
| `ticket_media`    | Extra photo/video attachments beyond the primary one on the ticket |
| `ticket_history`  | Status-change audit trail per ticket                                |
| `notifications`   | Per-user notifications linked to a ticket, public service, or notice |
| `notices`         | Manager drafts, schedules, sent notices, expiry, and delivery metadata |
| `notice_targets`  | Towers selected for each notice                                      |
| `public_services` | Society-wide service pages with assignment, resolution, and merge state |
| `public_reports` | Original resident reports contained by a public service page |
| `public_report_media` | Photos attached to individual public reports |
| `public_service_comments` | Society discussion for an active public service |
| `public_service_history` | Auditable public-service lifecycle and merge events |
| `public_similarity_suggestions` | AI scores, employee decisions, and resulting merged page |

Public services are intentionally separate from private `tickets`. Residents can see every public
service in this single-society deployment, while maintenance staff see only assigned public jobs.
Resolved discussions are read-only. Managers can inspect public services and analytics but cannot
change public-service status.

Manager notices use the lifecycle `Draft -> Scheduled -> Sent -> Expired` (with cancellation before
delivery). Device-local selections are converted to UTC; a backend scheduler checks every 30
seconds and creates one in-app notification for each active resident in the selected towers. The
backend must be running for scheduled delivery.

## Auth

- `POST /api/v1/auth/register` — creates a user (residents are active immediately; other roles
  start `pending` until a facility employee/manager promotes their `account_status`).
- `POST /api/v1/auth/login` — OAuth2 password flow, returns a JWT bearer token.
- Protected endpoints read the token via `Authorization: Bearer <token>`.

## Testing

The test suite (`tests/`) uses **pytest** against every endpoint, running against an in-memory
SQLite database — no Docker/Postgres required just to run tests. Real AWS calls are mocked out
(`mock_s3` fixture), and the rate limiter is disabled by default (autouse fixture) so unrelated
tests don't trip on each other's request counts.

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements-dev.txt
pytest                              # run everything
pytest -v                           # verbose, one line per test
pytest tests/test_tickets.py        # just one file
pytest --cov=app --cov-report=term-missing   # with a coverage report
```

If you already have the `SETUP.md` dev environment running via Docker, you can instead run tests
inside the container: `docker compose exec api pip install -r requirements-dev.txt && docker
compose exec api pytest`.

Test layout mirrors `app/api/v1/endpoints/` — one file per router (`test_auth.py`,
`test_tickets.py`, etc.) — plus `test_security.py` for the password-hashing/JWT helpers and
`test_health.py` for the `/health` check. `tests/conftest.py` has the shared fixtures: the SQLite
test database, an authenticated `client` per role (`resident_user`/`employee_user`/
`maintenance_user`/`manager_user` + `auth_headers(user)`), and factory fixtures (`make_user`,
`make_apartment`, `make_category`) for building test data.

### is this a feature or a bug?
One test `(test_resident_cannot_close_before_resolved)` documents a real gap rather than papering over it: the backend lets a resident jump a ticket straight to `Closed` from any status, not just `Resolved` — there's no server-side check enforcing the intended order. Wasn't in scope to fix while writing tests, but flagging it since it's a real permission gap, not just a style nit.

## API Validation Report

`scripts/generate_api_report.py` cross-checks what the OpenAPI spec documents against what the
test suite actually observes at runtime. FastAPI only auto-documents an endpoint's success status
plus `422`; anything else it genuinely returns (`401`/`403`/`404`/`429`/`503`, etc.) silently stays
undocumented unless the route explicitly declares it via `responses=` — this catches that drift
automatically instead of relying on manual spec review.

```bash
cd backend
.venv\Scripts\python.exe scripts\generate_api_report.py   # Windows
.venv/bin/python scripts/generate_api_report.py             # macOS/Linux
```

One command does everything:
1. Regenerates `openapi.yaml` straight from the live FastAPI app (always fresh, never hand-edited)
   and parses every operation's method, path, and documented response statuses — nothing is
   hardcoded, so adding/removing a route is picked up automatically.
2. Runs the full pytest suite. `tests/conftest.py` patches `TestClient.request()` once (the single
   choke point every `.get()`/`.post()`/`.patch()`/`.delete()` call funnels through) to record every
   real HTTP call any test makes — method, concrete path, status code, test id — to
   `reports/api_execution_results.json`, with zero changes to the tests themselves.
3. Maps each captured concrete path back to its OpenAPI template (e.g. `/api/v1/tickets/abc123` →
   `/api/v1/tickets/{ticket_id}`, query strings ignored) and aggregates every observed status per
   operation.
4. Classifies each API operation as **PASS** (every observed status is documented),
   **MISMATCH** (a status was observed that isn't documented), or **NOT TESTED** (no test hit it at
   all — documented-but-unexercised statuses alone are *not* a mismatch), and writes
   `reports/api_validation_report.html`.

Open `reports/api_validation_report.html` in a browser for the full table plus a breakdown of
exactly which test(s) produced each undocumented status code. Both `openapi.yaml` and `reports/`
are gitignored (fully regenerated, never hand-edited) — re-run the script any time to refresh them.

## Deployment

Local development (`docker compose up --build`, per `SETUP.md`) is the default and stays that way
regardless of anything below — it doesn't depend on any of this. When you're ready to put the
backend + a real Postgres somewhere live, see **[RENDER_DEPLOY.md](./RENDER_DEPLOY.md)** — a
step-by-step guide to deploying on Render. It's purely additive: no second `docker-compose.yml`,
no changes to how local dev works.

## Not Yet Implemented

This is a skeleton. Still to add as the project grows:
- Gemini AI-assisted complaint description/category/priority suggestion
- Pagination/filtering beyond the basic role-based scoping and `status` filter on tickets
- Frontend (Jest) test coverage — this backend suite doesn't cover the Expo app

Ticket comment threads (resident/staff/employee) now work end-to-end via the frontend's
`app/comments/[ticketId].tsx` screen, polling this API every ~8s while open — not WebSocket-based
real-time push, which would need backend changes this repo doesn't have yet.
