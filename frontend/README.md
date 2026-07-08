# Simplifix Frontend

This README is only for the `frontend/` Expo React Native app of Simplifix. For the complete project overview, planned backend, AI integrations, and team details, see the root [`README.md`](../README.md).

Simplifix is an AI-assisted complaint management app for residential communities, with role-based mobile experiences for residents, facility employees, maintenance staff, and facility managers.

## What This Frontend Does

The current frontend streamlines the maintenance-complaint lifecycle for a residential community:

- **Residents** file complaints (plumbing, electrical, etc.) with AI-assisted category/priority suggestions, attach photos or videos, and track status through to resolution.
- **Facility employees** triage incoming complaints and assign them to maintenance staff.
- **Maintenance staff** work through their assigned jobs and update progress.
- **Facility managers** get a portfolio-wide view of history and team performance.

## Frontend Setup

```bash
cd frontend
npm install
npx expo start
```

Then, in the terminal:

- Press `i` — open in iOS Simulator
- Press `a` — open in Android Emulator
- Press `w` — open in a web browser
- Scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network)

No environment variables or API keys are needed for the current frontend. The app runs entirely on local mock data (`src/data`) and on-device storage (`AsyncStorage`).

### Try it without creating an account

On the login screen, tap any of the listed demo accounts to jump straight into the app as a Resident, Facility Employee, Maintenance Staff, or Facility Manager.

## Frontend Project Structure

```
frontend/
├─ src/
│  ├─ app/                 # Expo Router screens (file-based routing)
│  │  ├─ (auth)/           # Welcome, login, register
│  │  ├─ (resident)/       # Resident tabs, complaint detail, new complaint
│  │  ├─ (employee)/       # Facility employee tabs, complaint detail
│  │  ├─ (maintenance)/    # Maintenance staff tabs, job detail
│  │  └─ (manager)/        # Facility manager tabs, complaint detail
│  ├─ components/
│  │  ├─ ui/               # Design-system primitives (Button, Card, Badge, Chip, ...)
│  │  └─ shared/           # Domain components built on the UI kit (TicketCard, CommentsThread, ...)
│  ├─ store/                # Zustand stores (auth, tickets, notifications), persisted to AsyncStorage
│  ├─ data/                 # Mock/seed data and complaint categories
│  ├─ types/                 # Shared TypeScript types
│  ├─ utils/                 # Date, id, mock-AI, and overdue helpers
│  └─ constants/theme.ts     # Design tokens: colors, spacing, radius, type scale, shadows
├─ app.json
├─ metro.config.js
└─ package.json
```

## Roles

| Role | Route group | Can do |
|---|---|---|
| Resident | `(resident)` | File complaints, track status, view history |
| Facility Employee | `(employee)` | Triage complaints, assign to maintenance staff |
| Maintenance Staff | `(maintenance)` | View and update assigned jobs |
| Facility Manager | `(manager)` | Portfolio-wide history and performance view |

## Frontend Tech Stack

- [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- React Native + TypeScript
- [Zustand](https://zustand.docs.pmnd.rs/) for state, persisted via `AsyncStorage`

## Frontend Scripts

Run these commands from the `frontend/` directory.

- `npm run start` — start the Metro dev server
- `npm run ios` / `npm run android` / `npm run web` — start and open a specific platform
- `npm run lint` — run ESLint

## Notes

- `metro.config.js` disables Metro's package-exports resolution. This is required because Zustand's ESM build otherwise crashes the web bundle with `Cannot use 'import.meta' outside a module` — Metro's web target doesn't support `import.meta`. See [expo/expo#36384](https://github.com/expo/expo/issues/36384) for background.
