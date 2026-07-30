# Simplifix Backend

FastAPI + PostgreSQL backend for Simplifix. Provides authentication and CRUD APIs for apartments,
users, categories, maintenance tickets, ticket history, comments, and notifications, matching the
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
│  │     └─ endpoints/  # auth, users, apartments, categories, tickets, comments, notifications
│  └─ main.py           # FastAPI app entrypoint
├─ alembic/             # migrations (env.py + versions/)
├─ scripts/
│  └─ seed_categories.py
├─ tests/               # pytest suite (see Testing below)
├─ requirements.txt
├─ requirements-dev.txt # requirements.txt + pytest/httpx, for running the test suite
├─ pytest.ini
├─ .env.example
├─ Dockerfile
└─ docker-compose.yml
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
```

API docs are then available at http://localhost:8000/docs.

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
| `comments`        | Ticket discussion thread                                           |
| `notifications`   | Per-user notifications, optionally linked to a ticket               |

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

## Not Yet Implemented

This is a skeleton. Still to add as the project grows:
- Gemini AI-assisted complaint description/category/priority suggestion
- Pagination/filtering beyond the basic role-based scoping and `status` filter on tickets
- Real-time chat between resident/staff/employee on a ticket
- Frontend (Jest) test coverage — this backend suite doesn't cover the Expo app
