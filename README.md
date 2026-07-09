# Simplifix

Simplifix is an AI-assisted apartment community maintenance management system built by **Pied Piper (MAY2026-Team-048)** as a curriculum requirement for the **B.S. in Data Science and Applications, IIT Madras**.

The project aims to replace fragmented maintenance communication across WhatsApp messages, phone calls, and paper registers with a structured workflow for reporting, assigning, resolving, and tracking residential maintenance complaints.

> Current status: the frontend mobile app has been started. It runs on local mock data and on-device storage. Backend, database, authentication server, cloud media storage, and live AI integrations are part of the planned full-system architecture.

## What the App Does

Simplifix centralizes the complete complaint lifecycle for apartment communities:

- Residents can create maintenance complaints, attach photos or videos, review AI-assisted complaint details, track status, verify completed work, and rate the resolution.
- Facility employees can review incoming complaints, validate AI-generated descriptions, assign jobs to maintenance staff, monitor workloads, and handle overdue complaints.
- Maintenance staff can view assigned jobs, inspect complaint details and media, update repair progress, add remarks, and upload completion proof.
- Facility managers can monitor analytics, complaint trends, staff performance, workload distribution, recurring issues, and historical records.

The intended complaint lifecycle is:

```text
Pending -> Assigned -> In Progress -> Resolved -> Resident Verification -> Closed
```

## Key Features

- AI-assisted complaint description, category, and priority suggestions
- Media-based complaint reporting with image/video attachments
- Role-based app experience for residents, facility employees, maintenance staff, and facility managers
- Complaint status tracking from submission to closure
- Worker assignment and workload visibility
- Completion proof, remarks, resident verification, and ratings
- Searchable complaint history and audit trail
- Manager analytics for resolution time, category trends, recurring issues, and staff performance

## Current Implementation

The current repository contains the Expo React Native frontend in [`frontend/`](./frontend).

Implemented frontend capabilities include:

- Expo Router file-based navigation
- Role-specific screen groups for all four user types
- Demo login accounts for quick role switching
- Mock complaint, user, worker, notification, and analytics data
- Zustand stores persisted with `AsyncStorage`
- Local mock AI helpers for complaint generation behavior
- Resident complaint creation and tracking flows
- Employee triage and assignment flows
- Maintenance job update flows
- Manager analytics, history, and performance views

No environment variables or API keys are currently required.

## Setup

### Prerequisites

- Node.js and npm
- Expo-compatible mobile device with Expo Go, Android Emulator, iOS Simulator, or a web browser
- Git

The project uses Expo. Expo SDK packages should be installed and kept in compatible versions through Expo tooling, for example with `npx expo install`, as recommended by the Expo documentation.

### Run the Frontend

From the repository root:

```bash
cd frontend
npm install
npx expo start
```

Then choose a target from the Expo terminal:

- Press `a` to open Android Emulator
- Press `i` to open iOS Simulator
- Press `w` to open the web app
- Scan the QR code with Expo Go on a physical phone connected to the same network

### Try Demo Roles

On the login screen, select any demo account to enter the app as:

- Resident
- Facility Employee
- Maintenance Staff
- Facility Manager

## Project Structure

```text
MAY2026-Team-048/
├─ README.md                 # Root project overview
├─ LICENSE
└─ frontend/                 # Current Expo React Native application
   ├─ src/
   │  ├─ app/                # Expo Router screens and route groups
   │  │  ├─ (auth)/          # Welcome, login, and registration screens
   │  │  ├─ (resident)/      # Resident dashboard, complaints, details, notifications
   │  │  ├─ (employee)/      # Employee dashboard, queue, workers, assignment
   │  │  ├─ (maintenance)/   # Maintenance staff job list and job detail flows
   │  │  └─ (manager)/       # Manager analytics, performance, history, details
   │  ├─ components/
   │  │  ├─ ui/              # Reusable UI primitives
   │  │  └─ shared/          # Domain-specific shared components
   │  ├─ constants/          # Theme and design tokens
   │  ├─ data/               # Mock data and categories
   │  ├─ store/              # Zustand stores
   │  ├─ types/              # Shared TypeScript types
   │  └─ utils/              # Date, ID, overdue, and mock AI helpers
   ├─ assets/                # App icons, splash assets, and images
   ├─ scripts/               # Utility scripts
   ├─ app.json               # Expo app configuration
   ├─ metro.config.js        # Metro bundler configuration
   ├─ package.json           # Frontend dependencies and scripts
   └─ tsconfig.json          # TypeScript configuration

```

## Roles

| Role              | Route group     | Primary responsibilities                                                                |
| ----------------- | --------------- | --------------------------------------------------------------------------------------- |
| Resident          | `(resident)`    | Submit complaints, attach media, track progress, verify completion, rate work           |
| Facility Employee | `(employee)`    | Review complaints, validate AI output, assign workers, monitor pending and overdue work |
| Maintenance Staff | `(maintenance)` | View assigned jobs, update progress, add remarks, upload completion proof               |
| Facility Manager  | `(manager)`     | Review analytics, monitor performance, inspect history, identify recurring issues       |

## Tech Stack

### Current Frontend

- Expo
- Expo Router
- React Native
- TypeScript
- Zustand
- AsyncStorage
- Expo Image Picker
- Expo Vector Icons
- React Native Reanimated
- React Native SVG

### Planned Full-System Stack

- Backend: FastAPI
- Database: PostgreSQL
- ORM and migrations: SQLAlchemy + Alembic
- Authentication: JWT
- AI: Gemini API
- Image and media storage: Cloudinary
- API documentation: Swagger/OpenAPI through FastAPI
- Charts: `react-native-chart-kit` for mobile and Chart.js where a web dashboard is added
- Project management: GitHub Projects

## Frontend Scripts

Run these from [`frontend/`](./frontend):

| Command                 | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `npm run start`         | Start the Expo Metro development server                     |
| `npm run android`       | Start Expo and open Android                                 |
| `npm run ios`           | Start Expo and open iOS                                     |
| `npm run web`           | Start Expo and open the web target                          |
| `npm run lint`          | Run Expo ESLint checks                                      |
| `npm run reset-project` | Run the local reset script provided in the frontend project |

## Contributors

- Abhay Sharma - @asabhaysharma
- Anusha Saha - @anusha-saha-3007
- Mursleen Khan - @MursleenK
- Namit Gutpa - @NamitCodes
- Sadaan Baksh - @SadaanBaksh

## Team

**Pied Piper (MAY2026-Team-048)**

Project made as part of the curriculum requirement for the **B.S. in Data Science and Applications, IIT Madras**.
