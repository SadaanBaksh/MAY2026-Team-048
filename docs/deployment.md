# Deploying the Backend + Postgres to Render

A from-scratch guide to getting the FastAPI backend and a real Postgres instance live on Render.

**This is purely additive — it does not change or replace local development in any way.**
`docker compose up --build` (see [setup.md](./setup.md)) keeps working exactly as before, against your local
Postgres. Render's Postgres is a separate, independent instance. Render also doesn't use
docker-compose at all: it builds `backend/Dockerfile` directly as a single container, and its
Postgres is a separate managed resource created through Render's dashboard — there's only ever the
one `docker-compose.yml` in this repo, and it's untouched.

---

## 1. Push to GitHub

Render deploys from a connected GitHub repo, so make sure your latest commit (including the
`Dockerfile` change and this guide) is pushed.

## 2. Create the Postgres instance

1. In the [Render Dashboard](https://dashboard.render.com/), click **New** → **PostgreSQL**.
2. Give it a name (e.g. `simplifix-db`), pick a region close to you.
3. **Instance Type**: Free is fine to start.
4. Click **Create Database**. Wait for it to become available.
5. On the database's page, copy the **Internal Database URL** (starts with `postgresql://`) — you
   need this in step 4. Use the *internal* one, not external: it's free and lower-latency as long
   as your web service ends up in the same region, which it will if you pick the same region below.

**Important:** Render's free Postgres tier is **deleted 30 days after creation** unless upgraded to
a paid plan. Easy to forget for a side project — if you come back a month later and the API can't
connect to the DB, this is why.

## 3. Create the Web Service

1. **New** → **Web Service** → connect your GitHub repo.
2. **Root Directory**: `backend` (the repo has both `frontend/` and `backend/` at the top level —
   this tells Render where the `Dockerfile` actually is).
3. Render should auto-detect **Runtime: Docker** from the `Dockerfile`. Same region as the database
   you just created.
4. **Instance Type**: Free is fine to start (see the cold-start note in Troubleshooting).
5. Don't click Create yet — set up the environment variables first (next step), or add them right
   after creation, before the first real deploy matters.

## 4. Environment variables

On the web service → **Environment** tab, add each of these (they map directly to
`app/core/config.py`'s `Settings` fields):

| Key | Value |
| --- | --- |
| `DATABASE_URL` | The Internal Database URL from step 2, **but with the driver added**: change `postgresql://...` to `postgresql+psycopg2://...`. This repo connects via the sync `psycopg2` driver (see `requirements.txt`), and Render's default connection string doesn't include the `+psycopg2` part — this is the single most common first error, so don't skip it. |
| `SECRET_KEY` | A freshly generated value — **not** the placeholder in `.env.example`, **not** the demo one in your local `.env`. Generate one: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `ALGORITHM` | `HS256` (matches the default, fine to set explicitly) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (or your preference) |
| `BACKEND_CORS_ORIGINS` | Comma-separated allowed origins. Only matters if you'll test via the Expo **web** build against this backend — CORS is a browser-only mechanism, so native app / device requests aren't affected by it either way. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME` | Reuse the same values from [s3-setup.md](./s3-setup.md). If the AWS key that was pasted into a chat session during setup hasn't been rotated yet, do that in IAM before going live. |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Required for registration/password-reset OTP emails to actually send, via SendGrid's HTTP API. `SENDGRID_FROM_EMAIL` must be verified first: app.sendgrid.com → Settings → Sender Authentication → **Single Sender Verification** — no domain/DNS needed, just confirm the link SendGrid emails to that address. Unlike Mailgun's sandbox mode, this only restricts the *from* address; you can send to any recipient once it's verified. If left blank, `app/services/email.py` silently skips sending and only logs a warning — the API still reports `"OTP sent successfully"`, so this is easy to miss until a user says emails never arrive. |
| `PROJECT_NAME` / `API_V1_STR` | Optional — the defaults (`Simplifix API` / `/api/v1`) are fine to leave unset. |

## 5. Deploy and watch the logs

Click **Create Web Service** (or **Manual Deploy** if you already created it). Watch the **Logs**
tab — you should see `alembic upgrade head` run and report success, then uvicorn start listening.
If it crashes here, check Troubleshooting below before digging further.

**Redeploys are the same.** `git push` to the connected branch rebuilds the container and re-runs
`alembic upgrade head` on start, so backend schema and API changes ship automatically — no manual
step. Still watch the logs for that line: if this environment's database is behind by several
migrations (or was ever built by anything other than Alembic), the catch-up run can fail on an
object that already exists. The frontend is separate — a push does **not** redeploy the Expo web
export or update installed apps.

## 6. Seed categories (one-time)

If you're on a **paid** Render plan, the web service's **Shell** tab works the same as local setup:

```bash
python -m scripts.seed_categories
```

**On the free tier, the Shell tab isn't available.** Instead, run the script locally, pointed at
Render's Postgres via its **External Database URL** (from the Postgres instance's dashboard — not
the Internal one, which only works from inside Render's network). The script
(`scripts/seed_categories.py`) is idempotent and reads its target purely from `DATABASE_URL`, so
this is safe and doesn't need any code changes:

```bash
# from backend/, with your local venv active. macOS/Linux/Git Bash:
DATABASE_URL="postgresql+psycopg2://<external URL, with +psycopg2 added>" python -m scripts.seed_categories
```
```powershell
# Windows PowerShell:
$env:DATABASE_URL = "postgresql+psycopg2://<external URL, with +psycopg2 added>"
python -m scripts.seed_categories
```

Same `+psycopg2` gotcha as step 4 applies to the external URL too. One-time — no need to repeat
unless the database gets wiped.

## 6.5. Create the demo accounts (if the app's "demo login" buttons need to work)

The frontend's demo-login shortcuts (`DEMO_CREDENTIALS` in `frontend/src/store/authStore.ts`)
assume four specific users already exist — `demo.resident@simplifix.app`,
`demo.employee@simplifix.app`, `demo.staff@simplifix.app`, `demo.manager@simplifix.app`, all with
password `Demo@1234`. **Nothing seeds these automatically** — they only exist on a fresh database
if you create them. Register all four against your Render URL (Swagger UI at `/docs` is the
simplest way — `POST /api/v1/auth/register` once per role), or via script:

```powershell
$base = "https://<your-service>.onrender.com"
$pw = "Demo@1234"
$accounts = @(
  @{ name="Demo Resident"; email="demo.resident@simplifix.app"; phone="+1 555-0100"; role="resident"; password=$pw; building="Wing A"; unit_number="101" },
  @{ name="Demo Employee"; email="demo.employee@simplifix.app"; phone="+1 555-0101"; role="facility_employee"; password=$pw; title="Facility Coordinator" },
  @{ name="Demo Staff"; email="demo.staff@simplifix.app"; phone="+1 555-0102"; role="maintenance_staff"; password=$pw; specialization="General Maintenance" },
  @{ name="Demo Manager"; email="demo.manager@simplifix.app"; phone="+1 555-0103"; role="facility_manager"; password=$pw }
)
foreach ($acct in $accounts) {
  try { Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/register" -ContentType "application/json" -Body ($acct | ConvertTo-Json) }
  catch { Write-Host "Skipped $($acct.email): $($_.Exception.Message)" }
}
```

`facility_employee`/`maintenance_staff` register as `pending` (only `resident`/`facility_manager`
go straight to `active` — see `ACTIVE_ON_REGISTER` in `auth.py`), so approve those two right after,
using the manager account you just created:

```powershell
$token = (Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType "application/x-www-form-urlencoded" -Body "username=demo.manager%40simplifix.app&password=$pw").access_token
$headers = @{ Authorization = "Bearer $token" }
$users = Invoke-RestMethod -Uri "$base/api/v1/users/" -Headers $headers
$users | Where-Object { $_.email -in @("demo.employee@simplifix.app","demo.staff@simplifix.app") } | ForEach-Object {
  Invoke-RestMethod -Method Patch -Uri "$base/api/v1/users/$($_.id)" -Headers $headers -ContentType "application/json" -Body '{"account_status":"active"}'
}
```

One-time, same as seeding categories — skip this entirely if you don't care about the demo-login
shortcuts and will just register real accounts through the app instead.

## 7. Verify

```bash
curl https://<your-service>.onrender.com/health
# {"status":"ok"}
```

Then open `https://<your-service>.onrender.com/docs` in a browser for the interactive Swagger UI.

## 8. (Optional) Point the app at it — reversible, not a replacement for local dev

If you want to test the Expo app against the live backend instead of your local one:

1. Open `frontend/.env` and **note the current value** of `EXPO_PUBLIC_API_URL` (right now it's a
   LAN IP for local device testing — write it down or keep the line commented out below the new
   one).
2. Temporarily set `EXPO_PUBLIC_API_URL=https://<your-service>.onrender.com`.
3. Restart `expo start` — `EXPO_PUBLIC_*` vars are baked in at bundle time, so a dev server that's
   already running won't pick up the change.
4. **When you're done testing against Render, switch it back** to the value from step 1 to resume
   normal local development against your local backend.

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| Logs show a `psycopg2` / connection error, or SQLAlchemy complains about the dialect | `DATABASE_URL` is missing the `+psycopg2` driver suffix — it must start with `postgresql+psycopg2://`, not just `postgresql://`. |
| `alembic upgrade head` fails on first deploy | Double check `DATABASE_URL` points at the right database and the Postgres instance is fully available (not still spinning up) — re-trigger a manual deploy once it is. |
| Requests from the Expo **web** build fail with a CORS error in the browser console | Add that origin (e.g. `http://localhost:8081` or wherever `expo start --web` is serving from) to `BACKEND_CORS_ORIGINS`, comma-separated, and redeploy. Native/device requests aren't affected by this at all. |
| First request after a while is very slow (~30-60s), then fine | Expected on Render's free tier — the service spins down after 15 minutes of inactivity and cold-starts on the next request. Not a bug; worth knowing about before a live demo (hit `/health` a minute beforehand to warm it up). |
| `python -m scripts.seed_categories` isn't found in the Shell tab | Make sure you're in `/app` (the Dockerfile's `WORKDIR`) — Render's Shell should already drop you there by default. |
| Web service → Shell tab says it's unavailable / greyed out | Free-tier limitation, not a bug — see the free-tier instructions in step 6 (run the script locally against the External Database URL instead). |
| Render dashboard says "No repositories found" even after granting GitHub access to the repo | Render's cached view of the GitHub App installation is often stale. Disconnect and reconnect GitHub from Render's **Account/Team Settings → Git Providers** (not just editing access on GitHub's side), and choose "All repositories" when reconnecting. If deploying under a Render **Team**, the GitHub connection must be authorized at the Team level, not just your personal account. |
