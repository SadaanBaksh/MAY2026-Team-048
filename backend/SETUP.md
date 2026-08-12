# Backend Setup Guide

This is a from-scratch guide for a new developer setting up the Simplifix backend for the first
time — including installing Docker and PostgreSQL. Pick **Option A (Docker)** unless you have a
specific reason to install PostgreSQL natively (Option B).

## 0. Prerequisites common to both options

- **Git** — you already have this if you cloned the repo.
- **A code editor** — VS Code recommended.
- **Python 3.12+** — needed either way (to run the API itself, and for Option B to run it outside
  a container).

  Check if you already have it:

  ```bash
  python --version
  # or on Windows
  py --version
  ```

  If it's missing or older than 3.12:
  - **Windows**: download the installer from https://www.python.org/downloads/ and run it. Check
    "Add python.exe to PATH" during install.
  - **macOS**: `brew install python@3.12` (install [Homebrew](https://brew.sh) first if needed).
  - **Linux (Debian/Ubuntu)**: `sudo apt update && sudo apt install python3.12 python3.12-venv`

---

## Option A: Docker (recommended)

Docker runs Postgres and the API in containers, so you don't install or manage Postgres yourself.

### A.1 Install Docker Desktop

- **Windows**:
  1. Install [WSL2](https://learn.microsoft.com/windows/wsl/install) first: open PowerShell as
     Administrator and run `wsl --install`, then restart your machine.
  2. Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
  3. Launch Docker Desktop and make sure it's using the WSL2 backend (default in recent versions).
- **macOS**: download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
  (choose Apple Silicon or Intel build to match your Mac).
- **Linux**: install [Docker Engine](https://docs.docker.com/engine/install/) for your distro, then
  the [Compose plugin](https://docs.docker.com/compose/install/linux/) (usually bundled together
  now). Add your user to the `docker` group so you don't need `sudo` for every command:
  ```bash
  sudo usermod -aG docker $USER
  # log out and back in for this to take effect
  ```

### A.2 Verify the install

```bash
docker --version
docker compose version
```

Both commands should print a version number, not an error. If Docker Desktop isn't running (icon
in your system tray/menu bar), start it now — the daemon must be running for the next steps.

### A.3 Configure the backend

```bash
cd backend
cp .env.example .env
```

The defaults in `.env.example` work as-is for local development — no edits required unless you
want a different port or a real secret key.

### A.4 Start everything

```bash
docker compose up --build
```

This will:
1. Pull and start a PostgreSQL 16 container (`db`).
2. Build the API image and start it (`api`).
3. Automatically run `alembic upgrade head` to create all tables before the API starts.

Leave this running in its own terminal. The first run takes a minute or two to build; subsequent
runs are fast.

### A.5 Seed the fixed category list (one-time)

In a **second terminal**:

```bash
cd backend
docker compose exec api python -m scripts.seed_categories
```

### A.6 Confirm it's working

Open http://localhost:8000/docs in a browser — you should see the interactive Swagger UI listing
all endpoints. Or from a terminal:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### Everyday commands (Docker)

| Task                              | Command                                              |
| ---------------------------------- | ----------------------------------------------------- |
| Start (with logs attached)         | `docker compose up`                                  |
| Start in background                | `docker compose up -d`                               |
| Stop                                | `docker compose down`                                |
| Stop and wipe the database too     | `docker compose down -v`                             |
| View API logs                      | `docker compose logs -f api`                         |
| Run a new migration after a model change | `docker compose exec api alembic revision --autogenerate -m "message"` then `docker compose exec api alembic upgrade head` |
| Open a shell in the API container | `docker compose exec api bash`                       |

You're done — skip to [Next Steps](#next-steps).

---

## Option B: Native install (no Docker)

Use this if Docker isn't available to you (e.g. locked-down machine) or you prefer running
Postgres directly.

### B.1 Install PostgreSQL

- **Windows**: download the installer from https://www.postgresql.org/download/windows/ (EDB
  installer). During setup:
  - Remember the password you set for the `postgres` superuser.
  - Keep the default port `5432`.
  - You can deselect Stack Builder at the end.
  - Add `C:\Program Files\PostgreSQL\<version>\bin` to your PATH if the installer didn't, so `psql`
    works from any terminal.
- **macOS**: `brew install postgresql@16` then `brew services start postgresql@16`.
- **Linux (Debian/Ubuntu)**: `sudo apt update && sudo apt install postgresql postgresql-contrib`,
  then `sudo systemctl enable --now postgresql`.

### B.2 Verify the install

```bash
psql --version
```

### B.3 Create the database and user

Open a `psql` session as the superuser:

```bash
# Windows: psql -U postgres
# macOS/Linux: sudo -u postgres psql
```

Then run:

```sql
CREATE USER simplifix WITH PASSWORD 'simplifix';
CREATE DATABASE simplifix OWNER simplifix;
\q
```

(Use a stronger password if this machine is shared or internet-facing.)

### B.4 Set up the Python environment

```bash
cd backend
py -3.13 -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### B.5 Configure the backend

```bash
cp .env.example .env
```

Edit `.env` so `DATABASE_URL` matches what you created in B.3 (the example already matches the
defaults above, so no change is needed if you used `simplifix`/`simplifix`).

### B.6 Run migrations and seed categories

```bash
alembic upgrade head
python -m scripts.seed_categories
```

### B.7 Start the API

```bash
uvicorn app.main:app --reload
```

### B.8 Confirm it's working

Open http://localhost:8000/docs, or:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

## Next Steps

- Register a test user and try the flow via the Swagger UI at `/docs`:
  1. `POST /api/v1/auth/register` with a resident payload.
  2. `POST /api/v1/auth/login` (use the "Authorize" button in Swagger, or pass
     `username`/`password` as form data) to get a token.
  3. Click "Authorize" in Swagger and paste the token to call protected endpoints like
     `POST /api/v1/tickets/`.
- See [README.md](./README.md) for the project structure and data model overview.
- Want to test photo/voice note uploads on tickets? See [S3_SETUP.md](./S3_SETUP.md) to set up AWS S3.
- Run the automated test suite: see the **Testing** section in [README.md](./README.md#testing) —
  it runs against an in-memory database, no Docker/Postgres needed just for tests.
- Ready to put the backend + a real Postgres somewhere live? See
  [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) — purely additive, doesn't change local dev at all.
- Changed a model? Generate a new migration:
  ```bash
  alembic revision --autogenerate -m "describe your change"
  alembic upgrade head
  ```

## Troubleshooting

| Problem                                                          | Fix                                                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `docker compose up` fails with a port conflict on 5432 or 8000    | Something else is already using that port. Stop it, or change the port mapping in `docker-compose.yml` (left side of the `:`). |
| `psql: error: connection to server ... failed`                    | Postgres isn't running. Windows: check the "postgresql-x64-&lt;version&gt;" service in Services. macOS: `brew services start postgresql@16`. Linux: `sudo systemctl start postgresql`. |
| `password authentication failed for user "simplifix"`             | `DATABASE_URL` in `.env` doesn't match the user/password you created in B.3 — fix one or the other. |
| `ValueError: password cannot be longer than 72 bytes` on register  | Your `bcrypt` package version drifted from `requirements.txt`. Re-run `pip install -r requirements.txt` inside the venv. |
| Alembic says "Target database is not up to date" / migration conflicts | Someone else added a migration you don't have yet — `git pull`, rebuild the API image, then run `alembic upgrade head` again. Never delete or replace a migration that may already have run in another environment; add a merge migration instead. |
