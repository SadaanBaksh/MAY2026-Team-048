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
├─ requirements.txt
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

## Not Yet Implemented

This is a skeleton. Still to add as the project grows:
- Cloudinary media upload integration (currently `image_url`/`media_url` are plain strings)
- Gemini AI-assisted complaint description/category/priority suggestion
- Pagination/filtering beyond the basic role-based scoping and `status` filter on tickets
- Automated tests
