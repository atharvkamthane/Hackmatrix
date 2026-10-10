# HackMatrix

HackMatrix is a consent-first healthcare records prototype. It demonstrates how a patient can control when a clinician receives access to selected health records, while keeping the user experience simple enough to explore on a phone or in a browser.

The repository contains an Expo doctor/patient application, a React administrator website, and a shared Express API. Explicit demo mode uses synthetic, device-local data. Production mode uses Clerk authentication and the shared API, which connects to MongoDB. This remains a prototype and is not a certified or production-ready healthcare system; do not use real patient information until the security, privacy, operational, and regulatory requirements have been independently reviewed.

## What the demo shows

HackMatrix supports two local demo roles:

- **Patient**
  - Review synthetic conditions, encounters, prescriptions, and observations.
  - Generate a temporary QR token for a clinician.
  - Review incoming access requests.
  - Approve or deny requests with selected record scopes and a time limit.
  - Review active grants and access history.
  - Revoke an active grant.
- **Clinician**
  - Scan a patient's temporary QR token, or use the one-device demo scan.
  - Wait for patient approval before records become visible.
  - View records covered by the approved grant.
  - Add synthetic encounters, prescriptions, and observations.

The consent flow is the main product path:

1. The clinician resolves a temporary QR token.
2. The patient sees a pending request.
3. The patient approves or denies the request.
4. An approved request creates a time-limited grant with explicit scopes.
5. The clinician can only read or write data covered by the active grant.
6. The patient can revoke access before the grant expires.

## Repository layout

This is a pnpm workspace:

```text
.
├── artifacts/
│   ├── hackmatrix-mobile/   # Expo Router doctor/patient application
│   ├── api-server/          # Shared Express API and MongoDB models
│   └── mockup-sandbox/      # Vite component preview application
├── apps/
│   └── admin-web/           # React/Vite administrator website
├── lib/
│   ├── api-spec/            # OpenAPI source specification
│   ├── api-client-react/    # Generated React Query API client
│   ├── api-zod/             # Generated Zod schemas and types
├── scripts/                 # Workspace utility scripts
├── package.json             # Root workspace scripts
├── pnpm-workspace.yaml      # Workspace packages and dependency catalog
└── README.md
```

### Mobile application

The mobile app lives in [`artifacts/hackmatrix-mobile`](./artifacts/hackmatrix-mobile). Routes are organized by role with Expo Router:

- `app/(patient)/` contains patient tabs and record/access screens.
- `app/(clinician)/` contains clinician tabs, scanning, waiting, patient, encounter, prescription, and observation screens.
- `src/screens/` contains the login, patient, and clinician screen implementations.
- `src/services/contracts.ts` defines replaceable authentication, patient, clinician, and realtime service interfaces.
- `src/services/mock.ts` implements explicit demo mode using AsyncStorage and synthetic seed data.
- `src/services/remote.ts` calls the shared API in production mode using the active Clerk token.
- `src/types/models.ts` contains shared domain types.
- `src/context/AppContext.tsx` provides app-level session and access metadata.

### API, database, and administrator website

- `artifacts/api-server` hosts the shared Express API on port `5000` by default.
- MongoDB/Mongoose connections and clinical models live under `artifacts/api-server/src/db` and `src/models`.
- The API resolves Clerk identities against MongoDB user/role mappings. Protected clinical and administrator routes enforce server-side role checks.
- The administrator API reads only non-identifying monthly surveillance aggregates from the analytics collection and applies K=10 suppression.
- The mobile service boundary selects AsyncStorage mocks only for explicit demo sessions; production requests use the same API.
- `apps/admin-web` obtains a Clerk session token and calls the shared API. Configure it with `apps/admin-web/.env` or deployment environment variables.
- PostgreSQL/Drizzle scaffolding has been removed from the active workspace. MongoDB is the application's database technology.
- `lib/api-spec/openapi.yaml`, `lib/api-zod`, and `lib/api-client-react` remain shared API-contract packages; the current mobile service adapter calls the REST routes directly.

## Technology stack

- TypeScript
- pnpm workspaces
- Expo SDK 57 and Expo Router
- React Native 0.86
- React 19
- AsyncStorage for explicit device-local demo state
- Clerk for mobile and administrator identity; server-side roles are loaded from MongoDB
- Express 5, Mongoose, MongoDB, CORS, rate limiting, Helmet, Pino, and Socket.IO
- OpenAPI 3.1
- Orval-generated API clients and Zod schemas
- Vite and React for the administrator website and component-preview sandbox

## Prerequisites

Install the following before working with the repository:

- Node.js compatible with the installed Expo and TypeScript toolchains
- pnpm
- For native mobile development, an Expo-compatible Android or iOS environment

The repository enforces pnpm through the root `preinstall` script. Do not use npm or Yarn to install dependencies.

Check your tool versions:

```bash
node --version
pnpm --version
```

## Installation

From the repository root:

```bash
pnpm install
```

Configure a root `.env` using `.env.example` for MongoDB and Clerk. Set `MONGODB_URI`, `CLERK_SECRET_KEY`, and `CLERK_PUBLISHABLE_KEY`; assign each Clerk user's `PATIENT`, `CLINICIAN`, or `ADMIN` role in the MongoDB `users` collection. Never commit `.env` or put server secrets in frontend environment files.

The workspace uses a one-day minimum package release age in `pnpm-workspace.yaml` as a supply-chain protection. A dependency must normally have been published for at least 1,440 minutes before pnpm will install it.

## Development commands

Run commands from the repository root.

### Type-check the complete workspace

```bash
pnpm run typecheck
```

This checks the shared libraries and then runs package-level type checks for the artifacts and scripts.

### Build the complete workspace

```bash
pnpm run build
```

This runs the workspace type check first and then invokes the build script for every package that defines one.

### Run the Expo mobile demo

```bash
pnpm --filter @workspace/hackmatrix-mobile run dev
```

The app is configured for the managed Expo/Replit preview workflow. For a local Expo workflow, you can also invoke the installed Expo CLI directly from the mobile package:

```bash
pnpm --filter @workspace/hackmatrix-mobile exec expo start
```

Useful mobile package commands:

```bash
pnpm --filter @workspace/hackmatrix-mobile run typecheck
pnpm --filter @workspace/hackmatrix-mobile run build
pnpm --filter @workspace/hackmatrix-mobile run serve
```

The mobile build script creates a web export. The `serve` script serves the generated output.

The mobile app supports explicit local demo mode and Clerk-backed production mode. In production, set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_BASE_URL` in the mobile environment. For a physical phone, use the development machine's LAN address instead of `localhost`.

### Run the administrator website

The admin app has its own package lock. Configure `apps/admin-web/.env` from `apps/admin-web/.env.example`, then run:

```bash
cd apps/admin-web
pnpm install --frozen-lockfile
pnpm dev
```

The Vite proxy sends `/api` and `/socket.io` to `http://localhost:5000` by default. For deployment, set `VITE_API_BASE_URL` to the shared API's `/api` URL and provide the Clerk publishable key. `VITE_DEMO_MODE` must only be enabled for an intentionally isolated demo build.

### Run the API server

Start MongoDB locally or configure MongoDB Atlas in the root `.env`. The API connects to MongoDB before it starts listening; `PORT` defaults to `5000`.

```bash
pnpm --filter @workspace/api-server run dev
```

Check liveness and dependency readiness:

```text
http://localhost:5000/api/healthz
http://localhost:5000/api/readyz
```

The server builds to `artifacts/api-server/dist` before starting. The generated output is ignored by Git.

### Shared API routes

Protected routes require a Clerk bearer token. The server resolves the user's active MongoDB role mapping; frontend-supplied roles are not trusted.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/healthz`, `/api/readyz` | Public status |
| GET | `/api/auth/me` | Authenticated profile, role, capabilities |
| GET | `/api/access/overview` | Patient or clinician consent overview |
| GET | `/api/patient/me`, `/api/patient/records` | Patient's own profile and records |
| GET | `/api/patient/qr-token` | Patient; creates a short-lived opaque QR token |
| GET | `/api/patient/access-requests`, `/api/patient/grants` | Patient's consent requests and grants |
| POST | `/api/patient/access-requests/:requestId/decision` | Patient approve/deny |
| POST | `/api/patient/grants/:grantId/revoke` | Patient revoke |
| POST | `/api/clinician/qr/resolve` | Clinician; consumes a single-use QR token and requests consent |
| GET | `/api/clinician/access-requests/:requestId` | Requesting clinician |
| GET | `/api/clinician/patients`, `/api/clinician/patients/:patientId` | Clinician with an active grant |
| POST | `/api/clinician/encounters`, `/api/clinician/prescriptions`, `/api/clinician/observations` | Clinician with matching active grant scope |
| GET | `/api/admin/summary`, `/api/admin/trends`, `/api/admin/regions`, `/api/admin/conditions` | Admin; MongoDB aggregates only |
| GET | `/api/admin/privacy-config`, `/api/admin/audit`, `/api/admin/security-events` | Admin |

All administrator endpoints require the server-assigned `ADMIN` role. The mobile API enforces patient ownership, organization membership, consent expiry/revocation, and per-record scopes.

### Run the component-preview sandbox

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

Other sandbox commands:

```bash
pnpm --filter @workspace/mockup-sandbox run typecheck
pnpm --filter @workspace/mockup-sandbox run build
pnpm --filter @workspace/mockup-sandbox run preview
```

The sandbox is a Vite preview host for generated mockup components. It is separate from the patient/clinician mobile application.

## Exploring the consent flow

The easiest way to test the complete flow on one device is:

1. Start the mobile app.
2. Select the **Clinician** role and use **Run demo scan**.
3. Switch to the **Patient** role.
4. Open the access requests area and approve the pending request.
5. Switch back to **Clinician**.
6. Open the authorized patient view and inspect the permitted records.
7. Add a synthetic encounter, prescription, or observation if desired.
8. Return to the patient role to review the grant or revoke it.

The patient seed data includes synthetic records and a pending clinician request so that this path is available immediately after installation.

## Data, privacy, and security boundaries

This repository remains a prototype, with explicit demo and production service paths:

- Demo records and demo sign-in are synthetic and device-local; they are not shared across devices.
- Production Clerk identities must have an active MongoDB user/role mapping and patient/clinician profile before clinical routes work.
- QR tokens are random, short-lived, single-use, hashed in MongoDB, and contain no patient record data.
- General administrator analytics read only the aggregate collection and suppress a result when any contributing cell is below K=10.
- No emergency-access endpoint/workflow or analytics ingestion pipeline is implemented yet. The analytics dashboard returns empty states until trusted aggregate documents are loaded.
- Real MongoDB/Clerk credentials and provider dashboard settings are required to exercise production flows; automated tests use isolated in-memory model validation and request fakes, not a live MongoDB instance.
- This repository does not provide a compliance certification, key-management service, backup/retention policy, or clinical interoperability implementation.

Do not enter real patient data, credentials, access tokens, or other sensitive information into the demo.

## Remaining work

- Provision a MongoDB test database and Clerk development application; create active user, organization, patient, and clinician mappings for end-to-end testing.
- Add trusted aggregate-data ingestion and source validation; do not populate production analytics with sample counts.
- Complete multi-factor/one-time-code sign-in handling for Clerk configurations that require it.
- Implement the explicitly required emergency-access workflow with reason, duration, patient notification, and immutable audit semantics.
- Add live MongoDB integration tests for database failures, consent expiry/revocation, QR replay prevention, role denial, and cross-app consistency.
- Keep `lib/api-spec/openapi.yaml` and generated packages aligned with the implemented route contract.

## Troubleshooting

### `pnpm install` is rejected

Confirm that pnpm is being used and that the package has passed the workspace's minimum release-age check. Do not bypass the check casually; use a narrowly reviewed allowlist entry only when there is a documented reason.

### The API server exits immediately

Set `PORT` to a positive integer before starting it. The server intentionally fails fast when `PORT` is missing or invalid.

### The clinician cannot see records

The patient must approve a pending request first, and the approved grant must still be active and include the requested scope. If you are testing on one device, use the built-in demo scan and switch between demo roles.

### Changes appear not to synchronize

The current implementation stores state locally in AsyncStorage. This is expected for the prototype; it is not a multi-device synchronization mechanism.

## Contributing

Before opening a pull request:

```bash
pnpm run typecheck
pnpm run build
```

Keep changes scoped to the relevant workspace package, preserve the service interfaces, and use synthetic data in tests and demos. If an API contract changes, update the OpenAPI source and regenerate the dependent client/schema packages together.

## License

The root package declares the MIT license. See [`package.json`](./package.json) for the repository package metadata.
