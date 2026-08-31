# Simplifix Frontend

This README is only for the `frontend/` Expo React Native app of Simplifix. For the complete project overview, backend, AI integrations, and team details, see the root [`README.md`](../README.md).

Simplifix is an AI-assisted complaint management app for residential communities, with role-based mobile experiences for residents, facility employees, maintenance staff, and facility managers.

## What This Frontend Does

The frontend streamlines the maintenance-complaint lifecycle for a residential community:

- **Residents** file complaints (plumbing, electrical, etc.) with AI-assisted category/priority suggestions, attach photos or voice notes, and track status through to resolution.
- **Residents** publish and discuss common-area issues in a separate Community feed. Each issue has a dedicated page, and merged pages retain all contributing reports.
- **Facility employees** triage incoming complaints, assign them to maintenance staff, and close a complaint from Pending with a required reason (outside-contractor fixes as well as implausible complaints).
- **Facility employees** accept or decline AI similarity merge popups, hand-pick any set of open public services to merge with checkboxes on the Public Services tab, and unmerge a combined page while it is still unassigned.
- **Maintenance staff** work through their assigned jobs and update progress.
- **Maintenance staff** see private and public assignments in one job queue.
- **Facility managers** get a portfolio-wide view of history and team performance, and suspend or reactivate resident/employee/maintenance accounts from the **People** tab. The manager workspace is desktop-first — on a phone it shows a "sign in from a desktop" screen with a log-out button.
- **Facility managers** see public-service totals, open/resolved counts, merged-report counts, and combined staff workloads.

## Frontend Setup

This app talks to the real Simplifix backend — it has no local mock-data mode. You need a running
backend first (local via Docker, see [`../docs/setup.md`](../docs/setup.md), or a deployed one,
see [`../docs/deployment.md`](../docs/deployment.md)).

```bash
cd frontend
npm install
cp .env.example .env   # then set EXPO_PUBLIC_API_URL, see below
npx expo start
```

Then, in the terminal:

- Press `i` — open in iOS Simulator
- Press `a` — open in Android Emulator
- Press `w` — open in a web browser
- Scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network)

### Pointing at a backend

Set `EXPO_PUBLIC_API_URL` in `frontend/.env` to the backend's URL:

- Android emulator: `http://10.0.2.2:8000` (the emulator's alias for the host machine's `localhost`)
- Web or iOS simulator, same machine as the backend: `http://localhost:8000`
- A physical phone: your dev machine's **LAN IP** (e.g. `http://192.168.1.23:8000`, from `ipconfig`/`ifconfig`) — `localhost` on a phone refers to the phone itself, not your computer, and both devices must be on the same Wi-Fi network
- A deployed backend (e.g. Render): its public URL, e.g. `https://simplifix-backend.onrender.com`

`EXPO_PUBLIC_*` variables are baked into the JS bundle at build time — restart `expo start` after
changing this value, reloading the app alone won't pick it up.

The Gemini API key is backend-only and never goes in an `EXPO_PUBLIC_` variable — see
[`../backend/README.md`](../backend/README.md#ai-features).

### Try it without creating an account

On the login screen, tap any of the listed demo accounts to jump straight into the app as a
Resident, Facility Employee, Maintenance Staff, or Facility Manager. These log in against the real
backend, so the demo users must already exist there — local Docker setups seed them automatically
(`docs/setup.md`); other environments need them created once (see `docs/deployment.md`).

## Frontend Project Structure

```
frontend/
├─ src/
│  ├─ app/                 # Expo Router screens (file-based routing)
│  │  ├─ (auth)/           # Landing, login, register, pending-approval (also the "account suspended" screen)
│  │  ├─ (resident)/       # Resident tabs, complaint detail, new complaint
│  │  ├─ (employee)/       # Facility employee tabs, complaint detail, public service detail (merge / unmerge)
│  │  ├─ (maintenance)/    # Maintenance staff tabs, job detail
│  │  └─ (manager)/        # Facility manager tabs (incl. People / account suspension); desktop-first, phones get DesktopOnlyNotice
│  ├─ api/                  # Backend API client
│  ├─ components/
│  │  ├─ ui/               # Design-system primitives (Button, Card, Badge, Chip, ...)
│  │  └─ shared/           # Domain components built on the UI kit (TicketCard, CommentsThread, ...)
│  ├─ store/                # Zustand stores (auth, tickets, public services, notices, notifications), persisted to AsyncStorage
│  ├─ data/                 # Complaint categories and legacy seed-data cleanup helpers
│  ├─ types/                 # Shared TypeScript types
│  ├─ utils/                 # Date, id, overdue, and validation helpers
│  └─ constants/theme.ts     # Design tokens: colors, spacing, radius, type scale, shadows
├─ app.json
├─ metro.config.js
└─ package.json
```

Roles and route groups are listed in the root [`README.md`](../README.md#roles).

## Frontend Tech Stack

- [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- React Native + TypeScript
- [Zustand](https://zustand.docs.pmnd.rs/) for state, persisted via `AsyncStorage`

## Frontend Scripts

Run these commands from the `frontend/` directory.

- `npm run start` — start the Metro dev server
- `npm run ios` / `npm run android` / `npm run web` — start and open a specific platform
- `npm run lint` — run ESLint
- `npm test` — run the Jest test suite

## Notes

- `metro.config.js` disables Metro's package-exports resolution. This is required because Zustand's ESM build otherwise crashes the web bundle with `Cannot use 'import.meta' outside a module` — Metro's web target doesn't support `import.meta`. See [expo/expo#36384](https://github.com/expo/expo/issues/36384) for background.
