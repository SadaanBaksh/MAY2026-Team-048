# Deploying the Backend + Postgres to Render

A from-scratch guide to getting the FastAPI backend and a real Postgres instance live on Render.

**This is purely additive — it does not change or replace local development in any way.**
`docker compose up --build` (see `SETUP.md`) keeps working exactly as before, against your local
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
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET_NAME` | Reuse the same values from `S3_SETUP.md`. If the AWS key that was pasted into a chat session during setup hasn't been rotated yet, do that in IAM before going live. |
| `PROJECT_NAME` / `API_V1_STR` | Optional — the defaults (`Simplifix API` / `/api/v1`) are fine to leave unset. |

## 5. Deploy and watch the logs

Click **Create Web Service** (or **Manual Deploy** if you already created it). Watch the **Logs**
tab — you should see `alembic upgrade head` run and report success, then uvicorn start listening.
If it crashes here, check Troubleshooting below before digging further.

## 6. Seed categories (one-time)

Same as local setup, just run it on Render instead: web service → **Shell** tab →

```bash
python -m scripts.seed_categories
```

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
