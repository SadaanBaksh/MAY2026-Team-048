# Simplifix

Simplifix is an AI-assisted apartment community maintenance management system built by **Pied Piper (MAY2026-Team-048)** as a curriculum requirement for the **B.S. in Data Science and Applications, IIT Madras**.

The project replaces fragmented maintenance communication across WhatsApp messages, phone calls, and paper registers with a structured workflow for reporting, assigning, resolving, and tracking residential maintenance complaints.

> Current status: a live FastAPI + PostgreSQL backend (JWT auth, AWS S3 media storage, Google Gemini AI integration) backs the Expo React Native frontend end-to-end. See [`frontend/README.md`](./frontend/README.md) and [`backend/README.md`](./backend/README.md) for how each half works, and [`docs/`](./docs) for setup, deployment, and AWS S3 guides.

## Live Deployment

| | URL |
| --- | --- |
| Frontend | https://may2026-team-048.onrender.com/ |
| Backend API | https://simplifix-backend.onrender.com/ |
| Backend API docs (Swagger) | https://simplifix-backend.onrender.com/docs |

Both run on Render's free tier, which spins down after 15 minutes of inactivity — the first
request after a while can take 30-60s to wake back up. See [`docs/deployment.md`](./docs/deployment.md)
for how this is deployed.

## What the App Does

Simplifix centralizes the complete complaint lifecycle for apartment communities:

- Residents can create maintenance complaints, attach photos or voice notes, review AI-assisted complaint details, track status, verify completed work, and rate the resolution.
- Residents can publish common-area public service reports, discuss them with neighbours, and follow a shared resolution page when reports are merged.
- Facility employees can review incoming complaints, validate AI-generated descriptions, assign jobs to maintenance staff, monitor workloads, handle overdue complaints, and reject implausible complaints or public reports with a required reason.
- Facility employees receive AI similarity suggestions for public reports and decide whether matching reports should be merged into a new combined service page.
- Maintenance staff can view assigned jobs, inspect complaint details and media, update repair progress, add remarks, and upload completion proof.
- Facility managers can monitor analytics, complaint trends, staff performance, workload distribution, recurring issues, and historical records, and draft AI-assisted resident notices.

The complaint lifecycle:

```text
Pending -> Assigned -> In Progress -> Resolved -> Resident Verification -> Closed
                    \-> Rejected (facility employee, Pending only, reason required)
```

## Key Features

- AI-assisted complaint description, category, and priority suggestions, including flagging media/text that isn't a real maintenance issue
- AI-assisted manager notices with tower targeting, editable drafts, scheduled delivery, and expiry
- AI resident support chat and AI-generated role-specific dashboard summaries
- Media-based complaint reporting via AWS S3-backed photo/voice-note uploads
- Role-based app experience for residents, facility employees, maintenance staff, and facility managers
- Complaint status tracking from submission to closure, including employee-reviewed rejection
- Worker assignment and workload visibility
- Completion proof, remarks, resident verification, and ratings
- Searchable complaint history and full audit trail
- Society-wide public service feed with comments and dedicated issue pages
- Employee-approved AI similarity scoring and information-preserving report merges
- Manager analytics for resolution time, category trends, recurring issues, and staff performance

## Architecture

- [`frontend/`](./frontend) — Expo React Native app (Expo Router, TypeScript, Zustand), talks to the backend over `EXPO_PUBLIC_API_URL`. See [`frontend/README.md`](./frontend/README.md).
- [`backend/`](./backend) — FastAPI + PostgreSQL API (SQLAlchemy, Alembic, JWT auth, Gemini AI, AWS S3). See [`backend/README.md`](./backend/README.md).
- [`docs/`](./docs) — local setup, AWS S3 setup, and production deployment guides.

| Layer | Stack |
| --- | --- |
| Frontend | Expo, Expo Router, React Native, TypeScript, Zustand |
| Backend | FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, JWT (`python-jose`/`passlib`) |
| AI | Google Gemini (or the AI Pipe Gemini-compatible proxy) |
| Media storage | AWS S3 |
| Local dev | Docker Compose |
| Production | Render (backend + Postgres) — see [`docs/deployment.md`](./docs/deployment.md) |

## Run It Locally

Both halves — backend API and Expo app — need to be running together. Start the backend first,
then the frontend.

### Prerequisites

- **Git**
- **Docker Desktop** (runs Postgres + the API in containers — no manual Postgres install). See
  [`docs/setup.md`](./docs/setup.md) if you'd rather install PostgreSQL natively instead.
- **Node.js and npm**, for the Expo frontend
- An Expo-compatible target: Android Emulator, iOS Simulator, a web browser, or a physical phone
  with the **Expo Go** app

### 1. Clone and start the backend

```bash
git clone <this repo's URL>
cd MAY2026-Team-048/backend
cp .env.example .env
docker compose up --build
```

Leave this running in its own terminal. The first run takes a minute or two to build; it also
runs database migrations automatically before the API starts.

### 2. Seed data (one-time, in a second terminal)

```bash
cd backend
docker compose exec api python -m scripts.seed_categories     # required
docker compose exec api python -m scripts.seed_demo_users     # optional - enables the demo-login buttons
docker compose exec api python -m scripts.seed_demo_services  # optional - sample tickets/public services
```

### 3. Confirm the backend is up

Open http://localhost:8000/docs in a browser — you should see the interactive Swagger UI. Or:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 4. Set up and start the frontend

In a third terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

Open `frontend/.env` and set `EXPO_PUBLIC_API_URL` to where the backend is reachable from your
Expo target:

| Target | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Web browser or iOS Simulator (same machine) | `http://localhost:8000` |
| Android Emulator | `http://10.0.2.2:8000` |
| Physical phone (Expo Go) | `http://<your machine's LAN IP>:8000` — find it with `ipconfig` (Windows) / `ifconfig` (macOS/Linux); phone and computer must be on the same Wi-Fi |

Then start Expo:

```bash
npx expo start
```

In the Expo terminal: press `w` for web, `a` for Android Emulator, `i` for iOS Simulator, or scan
the QR code with Expo Go on your phone.

### 5. Log in

On the login screen, tap any demo account (Resident, Facility Employee, Maintenance Staff,
Facility Manager) if you ran the optional seed scripts in step 2 — or register a real account.

### Troubleshooting and other setups

- Full step-by-step guide, including a no-Docker/native-PostgreSQL option and a troubleshooting
  table: [`docs/setup.md`](./docs/setup.md)
- Full frontend setup details: [`frontend/README.md`](./frontend/README.md)
- Testing photo/voice-note uploads locally needs AWS S3 configured: [`docs/s3-setup.md`](./docs/s3-setup.md)
- Deploying the backend (Render): [`docs/deployment.md`](./docs/deployment.md)

## Roles

| Role              | Route group     | Primary responsibilities                                                                |
| ----------------- | --------------- | ----------------------------------------------------------------------------------------- |
| Resident          | `(resident)`    | Submit complaints, attach media, track progress, verify completion, rate work           |
| Facility Employee | `(employee)`    | Review complaints, validate AI output, assign workers, reject implausible reports, monitor pending/overdue work |
| Maintenance Staff | `(maintenance)` | View assigned jobs, update progress, add remarks, upload completion proof               |
| Facility Manager  | `(manager)`     | Review analytics, monitor performance, inspect history, identify recurring issues       |

## Contributors

- Abhay Sharma - @asabhaysharma
- Anusha Saha - @anusha-saha-3007
- Mursleen Khan - @MursleenK
- Namit Gupta - @NamitCodes
- Sadaan Baksh - @SadaanBaksh

## Team

**Pied Piper (MAY2026-Team-048)**

Project made as part of the curriculum requirement for the **B.S. in Data Science and Applications, IIT Madras**.
