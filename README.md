# HackMatrix

HackMatrix is a consent-first healthcare records prototype. It demonstrates how a patient can control when a clinician receives access to selected health records, while keeping the user experience simple enough to explore on a phone or in a browser.

The repository currently contains a working Expo mobile demonstration, a small API foundation, generated API packages, and a component-preview sandbox. The mobile demonstration intentionally uses synthetic data and device-local storage; it is not a production healthcare system and must not be used with real patient information.

## What the demo shows

HackMatrix has two mobile experiences selected from the authenticated, server-resolved role:

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
│   ├── hackmatrix-mobile/   # Expo Router mobile application
│   ├── api-server/          # Express API host and health route
│   └── mockup-sandbox/      # Vite component preview application
├── lib/
│   ├── api-spec/            # OpenAPI source specification
│   ├── api-client-react/    # Generated React Query API client
│   └── api-zod/             # Generated Zod schemas and types
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
- `src/services/mock.ts` implements the current demo using AsyncStorage and synthetic seed data.
- `src/types/models.ts` contains shared domain types.
- `src/context/AppContext.tsx` provides app-level session and access metadata.

### API and shared packages

The API foundation is intentionally small at this stage:

- `artifacts/api-server` hosts an Express application under `/api`.
- `GET /api/healthz` is the currently implemented endpoint.
- `GET /api/readyz` reports whether both logical MongoDB connections are ready.
- `GET /api/auth/me` and the temporary `/api/auth/test/*` routes exercise the authentication and authorization foundation.
- `artifacts/api-server/src/db` owns separate clinical and analytics Mongoose connections.
- `artifacts/api-server/src/config` validates environment configuration at startup.
- `artifacts/api-server/src/middleware` provides Helmet, explicit CORS, rate limiting, request IDs, body limits, error handling, and Zod validation helpers.
- `artifacts/api-server/src/auth` verifies Clerk requests and provides server-controlled role and organization authorization helpers.
- `lib/api-spec/openapi.yaml` is the source OpenAPI document.
- `lib/api-zod` contains generated validation schemas and API types.
- `lib/api-client-react` contains the generated React Query client.

The mobile app now uses Clerk for sign-in/sign-up and obtains its patient or clinician navigation role from the protected API. The bundled synthetic clinical screens still use a local mock service until their corresponding server endpoints are implemented; they are not protected production clinical operations. Clinical models, consent endpoints, QR resolution, realtime events, and analytics repositories are intentionally not implemented in this phase.

## Technology stack

- TypeScript
- pnpm workspaces
- Expo SDK 57 and Expo Router
- React Native 0.86
- React 19
- AsyncStorage for device-local demo state
- Express 5, CORS, Pino, and Pino HTTP logging for the API foundation
- Mongoose and MongoDB Atlas connection boundaries
- Clerk backend token verification
- OpenAPI 3.1
- Orval-generated API clients and Zod schemas
- Vite and React for the component-preview sandbox

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

### Configure Clerk for the Expo app

Copy `artifacts/hackmatrix-mobile/.env.example` to `artifacts/hackmatrix-mobile/.env` and set these public mobile settings (the publishable key is safe to expose; do not place a Clerk secret key in a mobile app):

```dotenv
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

For a physical phone, replace `localhost` in `EXPO_PUBLIC_API_BASE_URL` with the development machine's reachable LAN address and make sure the API CORS configuration permits the Expo development origin. In the Clerk Dashboard, enable the **Native API** and register the app's `hackmatrix-mobile` deep-link scheme/native application before creating a production build.

The mobile client uses Clerk's hosted sign-in/sign-up flow, persists Clerk session state with Expo Secure Store, and sends a freshly retrieved Clerk session token as `Authorization: Bearer <token>` through `src/services/api.ts`. It then calls `GET /api/auth/me`; that response, rather than local storage, a route, or a role selector, determines patient versus clinician navigation. An `ADMIN` account is intentionally directed to the future web administration experience.

To test end-to-end, assign the user a trusted server-side `PATIENT` or `CLINICIAN` role claim in Clerk, sign in on the mobile app, and confirm that `/api/auth/me` returns the expected normalized identity. The existing synthetic-screen mock remains solely for UI development until protected clinical API endpoints replace it.

### Run the API server

The API server loads configuration from environment variables. For local development, copy the root `.env.example` to `.env` and replace the placeholders with your MongoDB Atlas and Clerk values. `.env` is ignored by Git and must never be committed.

```bash
# PowerShell
Copy-Item .env.example .env
# Edit .env and replace the placeholders, then run:
pnpm --filter @workspace/api-server run dev
```

The API startup imports `dotenv` before validating configuration and checks both the API package directory and repository root, so the root `.env` works with the pnpm workspace command. In production, set the same variables through the deployment platform's secret/environment settings instead of committing a file.

The API server requires a positive `PORT` environment variable. In production it also requires `MONGODB_URI`; development and tests can start without MongoDB, but `/api/readyz` remains unavailable until both logical database connections are configured and connected.

```bash
# macOS/Linux
PORT=3000 pnpm --filter @workspace/api-server run dev
```

Then check the health endpoint:

```text
http://localhost:3000/api/healthz
```

Readiness is intentionally separate:

```text
http://localhost:3000/api/readyz
```

`/api/healthz` only confirms that the process is alive. `/api/readyz` returns `200` only when both the clinical and analytics Mongoose connections are ready, and returns `503` without exposing connection details otherwise.

The server builds to `artifacts/api-server/dist` before starting. The generated output is ignored by Git.

## Authentication and authorization foundation

The backend uses Clerk to verify bearer/session authentication server-side. Set these variables for the API:

```text
CLERK_SECRET_KEY=sk_test_... or sk_live_...
CLERK_AUTHORIZED_PARTIES=https://mobile.example.com,https://admin.example.com
CLERK_ROLE_CLAIM=metadata.role
```

`CLERK_SECRET_KEY` is required in production. `CLERK_AUTHORIZED_PARTIES` should list the exact trusted client origins/parties used by the deployed clients. The default role claim path is `metadata.role`; it can be changed only through server configuration.

Roles are assigned in the Clerk-controlled session claims configuration, not by the client. The currently supported values are exactly:

- `PATIENT`
- `CLINICIAN`
- `ADMIN`

Before deploying, configure a Clerk session token/JWT claim at `metadata.role` (or set `CLERK_ROLE_CLAIM` to the server-approved claim path) and provision the appropriate value through trusted Clerk administration. A missing or invalid role produces `403 ROLE_NOT_ASSIGNED`; the backend never defaults to a privileged role.

The request pipeline is:

```text
Clerk bearer/session token
  -> Clerk signature and request verification
  -> normalized userId, role, organizationId
  -> requireAuth()
  -> requireRole("PATIENT" | "CLINICIAN" | "ADMIN")
  -> organization authorization
  -> future patient/grant/scope authorization
```

The backend ignores role values in query parameters, request bodies, custom headers, AsyncStorage, and frontend navigation state. The existing mobile role selector remains a demo-only UI and is not connected to these protected backend routes.

Temporary foundation endpoints:

```text
GET /api/auth/me
GET /api/auth/test/patient
GET /api/auth/test/clinician
GET /api/auth/test/admin
GET /api/auth/test/organization/:organizationId
```

These routes expose only authorization-test status or normalized identity fields; they do not expose clinical data. They are intended for foundation testing and should be removed or placed behind an internal feature boundary before production launch.

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

This repository contains a demonstration implementation only:

- All bundled records are synthetic.
- Demo sign-in selects a local role; it is not authentication.
- AsyncStorage is device-local. A second device will not see the first device's requests, grants, QR tokens, or records.
- QR payloads contain opaque, temporary tokens rather than patient identifiers or clinical details.
- The mobile app enforces role and scope checks in its mock service, but a production server must enforce them independently.
- The API server currently exposes only a health check and is not connected to the mobile demo.
- No production identity provider, audit-grade storage, encryption/key management, clinical interoperability, or regulatory compliance layer is implemented.

Do not enter real patient data, credentials, access tokens, or other sensitive information into the demo.

## Design and extension notes

The service boundary is deliberately replaceable. To connect a real backend:

1. Keep the interfaces in `artifacts/hackmatrix-mobile/src/services/contracts.ts` as the client contract.
2. Add a network-backed implementation alongside `src/services/mock.ts`.
3. Select the implementation from `src/services/index.ts`.
4. Move authorization, scope enforcement, expiry checks, and audit logging to the server.
5. Replace the local AsyncStorage state with durable, access-controlled persistence.
6. Expand `lib/api-spec/openapi.yaml`, then regenerate the API client and Zod packages.
7. Add integration and end-to-end tests for denial, expiry, revocation, and scope boundaries.

Keep the current mock implementation available for deterministic demos and UI development.

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
