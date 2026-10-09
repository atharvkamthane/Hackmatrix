# HackMatrix Mobile

An Expo demo app for patients and clinicians to review synthetic health records and test scoped, patient-approved access.

## Run & Operate

- `pnpm --filter @workspace/hackmatrix-mobile run typecheck` — typecheck the mobile app
- The managed preview workflow is `artifacts/hackmatrix-mobile: expo`.
- The mobile demo has no backend or database dependency; do not start or add one for this artifact.

## Stack

- Expo Router, React Native, TypeScript, AsyncStorage
- Mock service implementations keep local synthetic data behind typed interfaces.
- `expo-camera` scans temporary QR tokens; `react-native-qrcode-svg` renders them.

## Where things live

- `artifacts/hackmatrix-mobile/app/` — role-specific routes and tab layouts.
- `artifacts/hackmatrix-mobile/src/screens/` — patient, clinician, and demo sign-in screens.
- `artifacts/hackmatrix-mobile/src/services/contracts.ts` — replaceable patient/clinician/auth service interfaces.
- `artifacts/hackmatrix-mobile/src/services/mock.ts` — AsyncStorage-backed demo implementations and synthetic seed data.
- `artifacts/hackmatrix-mobile/src/types/models.ts` — shared domain types.
- `artifacts/hackmatrix-mobile/constants/colors.ts` — light and dark theme tokens.

## Architecture decisions

- This is a client-only prototype. Patient and clinician roles are local demo roles, not real authentication.
- Clinicians see no health records until a patient approves an active grant; access checks include expiry and scope.
- QR payloads contain only opaque, temporary tokens, never patient identifiers or health details.
- The app-wide context contains consent/access metadata only. Clinical records are fetched through the role-specific service.
- ADMIN remains outside this mobile app in the separate web product.

## Product

Patients can view synthetic conditions, encounters, prescriptions, and observations; show a temporary QR; approve or deny scoped access; review grants and access history; and revoke active access. Clinicians can scan a QR or run a one-device demo scan, wait for patient approval, view authorized records, and add encounters, prescriptions, or observations.

## User preferences

Use synthetic data only. Do not add a backend, database, auth provider, or real patient information to this mobile artifact. Keep the mock service boundary replaceable for the separately owned backend integration.

## Gotchas

- AsyncStorage is device-local. Separate devices do not synchronize QR tokens, requests, grants, or records until a backend service is connected.
- Use the built-in `Run demo scan` action to exercise the full consent flow on one device.
- When a team-owned API contract is available, replace the mock exports in `src/services/index.ts`; keep grant and scope checks enforced by the server as well.

## Pointers

- See the `expo` skill for Expo Router and mobile-specific implementation guidance.
