import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AccessEvent,
  AccessScope,
  DemoState,
  Encounter,
  Observation,
  PatientQrToken,
  Prescription,
  Role,
} from '@/src/types/models';
import type { HackMatrixServices } from './contracts';

const STATE_KEY = 'hackmatrix.demo.state.v1';
const SESSION_KEY = 'hackmatrix.demo.session.v1';
const DEMO_PATIENT_ID = 'patient-demo-01';
const DEMO_CLINICIAN_ID = 'clinician-demo-01';
const QR_TTL_MS = 10 * 60 * 1000;
const listeners = new Set<(event: AccessEvent) => void>();

const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const emit = (event: AccessEvent) => {
  listeners.forEach((listener) => listener(event));
};

function seedState(): DemoState {
  const today = new Date();
  const daysAgo = (days: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() - days);
    return value.toISOString();
  };
  const dateOnly = (days: number) => daysAgo(days).slice(0, 10);

  return {
    patient: {
      id: DEMO_PATIENT_ID,
      name: 'Amara Shah',
      age: 34,
      bloodType: 'O+',
      memberSince: '2021',
    },
    conditions: [
      {
        id: 'condition-01',
        name: 'Mild asthma',
        status: 'Active',
        since: '2020',
        note: 'Managed with an as-needed inhaler.',
      },
      {
        id: 'condition-02',
        name: 'Seasonal allergic rhinitis',
        status: 'Active',
        since: '2019',
        note: 'Symptoms typically increase in spring.',
      },
    ],
    encounters: [
      {
        id: 'encounter-01',
        diagnosis: 'Routine follow-up',
        reason: 'Annual wellness visit',
        date: dateOnly(18),
        clinicianName: 'Dr. Priya Nair',
        organization: 'Harbor Health Clinic',
      },
      {
        id: 'encounter-02',
        diagnosis: 'Seasonal allergic rhinitis',
        reason: 'Allergy symptoms',
        date: dateOnly(104),
        clinicianName: 'Dr. Priya Nair',
        organization: 'Harbor Health Clinic',
      },
    ],
    prescriptions: [
      {
        id: 'prescription-01',
        drug: 'Albuterol inhaler',
        dose: '90 mcg',
        frequency: 'As needed',
        start: dateOnly(18),
        end: dateOnly(198),
        clinicianName: 'Dr. Priya Nair',
      },
      {
        id: 'prescription-02',
        drug: 'Cetirizine',
        dose: '10 mg',
        frequency: 'Once daily',
        start: dateOnly(18),
        end: dateOnly(48),
        clinicianName: 'Dr. Priya Nair',
      },
    ],
    observations: [
      {
        id: 'observation-01',
        title: 'Blood pressure',
        value: '118/76',
        unit: 'mmHg',
        date: dateOnly(18),
        clinicianName: 'Dr. Priya Nair',
      },
      {
        id: 'observation-02',
        title: 'Heart rate',
        value: '72',
        unit: 'bpm',
        date: dateOnly(18),
        clinicianName: 'Dr. Priya Nair',
      },
    ],
    requests: [
      {
        id: 'request-seed-01',
        patientId: DEMO_PATIENT_ID,
        clinicianId: DEMO_CLINICIAN_ID,
        clinicianName: 'Dr. Maya Chen',
        organization: 'Harbor Health Clinic',
        scopes: ['Conditions', 'Encounters', 'Prescriptions'],
        durationMinutes: 60,
        createdAt: daysAgo(0),
        status: 'pending',
      },
    ],
    grants: [],
    history: [
      {
        id: 'history-01',
        actor: 'Dr. Priya Nair',
        organization: 'Harbor Health Clinic',
        action: 'Viewed shared records',
        occurredAt: daysAgo(18),
        detail: 'Access was provided by an approved patient consent.',
      },
      {
        id: 'history-02',
        actor: 'Dr. Priya Nair',
        organization: 'Harbor Health Clinic',
        action: 'Access ended',
        occurredAt: daysAgo(18),
        detail: 'The time-limited access window expired.',
      },
    ],
  };
}

async function readState(): Promise<DemoState> {
  const saved = await AsyncStorage.getItem(STATE_KEY);
  if (!saved) {
    const initial = seedState();
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(saved) as DemoState;
}

async function updateState(mutator: (state: DemoState) => DemoState): Promise<DemoState> {
  const current = await readState();
  const next = mutator(current);
  await AsyncStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

function activeGrant(state: DemoState) {
  const now = Date.now();
  return state.grants.find(
    (grant) =>
      grant.status === 'active' &&
      grant.patientId === DEMO_PATIENT_ID &&
      grant.clinicianId === DEMO_CLINICIAN_ID &&
      new Date(grant.expiresAt).getTime() > now,
  );
}

async function requireRole(expected: Role) {
  const saved = await AsyncStorage.getItem(SESSION_KEY);
  const session = saved ? (JSON.parse(saved) as { role: Role }) : null;
  if (session?.role !== expected) {
    throw new Error(
      expected === 'patient'
        ? 'Switch to the patient demo role to access this feature.'
        : 'Switch to the clinician demo role to access this feature.',
    );
  }
}

function requireScope(state: DemoState, scope: AccessScope) {
  const grant = activeGrant(state);
  if (!grant) {
    throw new Error('There is no active patient grant. Ask the patient to approve access first.');
  }
  if (!grant.scopes.includes(scope)) {
    throw new Error(`This grant does not include ${scope.toLowerCase()} access.`);
  }
}

export const mockServices: HackMatrixServices = {
  auth: {
    async getSession() {
      const saved = await AsyncStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as { role: Role }) : null;
    },
    async signIn(role) {
      const session = { role };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    },
    async signOut() {
      await AsyncStorage.removeItem(SESSION_KEY);
    },
  },
  patient: {
    async getDemoOverview() {
      const { requests, grants, history } = await readState();
      return { requests, grants, history };
    },
    async getMe() {
      await requireRole('patient');
      return (await readState()).patient;
    },
    async getRecords() {
      await requireRole('patient');
      const { conditions, encounters, prescriptions, observations } = await readState();
      return { conditions, encounters, prescriptions, observations };
    },
    async getQrToken() {
      await requireRole('patient');
      let state = await readState();
      if (!state.qrToken || new Date(state.qrToken.expiresAt).getTime() <= Date.now()) {
        const token = `hmxqr:v1:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        const nextToken: PatientQrToken = {
          payload: token,
          expiresAt: new Date(Date.now() + QR_TTL_MS).toISOString(),
        };
        state = await updateState((current) => ({ ...current, qrToken: nextToken }));
      }
      return state.qrToken!;
    },
    async getAccessRequests() {
      await requireRole('patient');
      return (await readState()).requests;
    },
    async decideAccessRequest(requestId, decision) {
      await requireRole('patient');
      const state = await readState();
      const request = state.requests.find((item) => item.id === requestId);
      if (!request || request.status !== 'pending') {
        throw new Error('This request is no longer waiting for a decision.');
      }
      const decidedAt = new Date().toISOString();
      const grantId = id('grant');
      await updateState((current) => {
        const requests = current.requests.map((item) =>
          item.id === requestId ? { ...item, status: decision, decidedAt } : item,
        );
        const grants =
          decision === 'approved'
            ? [
                ...current.grants,
                {
                  id: grantId,
                  patientId: request.patientId,
                  clinicianId: request.clinicianId,
                  clinicianName: request.clinicianName,
                  organization: request.organization,
                  scopes: request.scopes,
                  createdAt: decidedAt,
                  expiresAt: new Date(
                    Date.now() + request.durationMinutes * 60 * 1000,
                  ).toISOString(),
                  status: 'active' as const,
                },
              ]
            : current.grants;
        const history =
          decision === 'approved'
            ? [
                {
                  id: id('history'),
                  actor: request.clinicianName,
                  organization: request.organization,
                  action: 'Patient approved access',
                  occurredAt: decidedAt,
                  detail: `Time-limited access to ${request.scopes.join(', ').toLowerCase()}.`,
                },
                ...current.history,
              ]
            : current.history;
        return { ...current, requests, grants, history };
      });
      emit({ type: 'access:decided', requestId, status: decision, grantId });
    },
    async getGrants() {
      await requireRole('patient');
      return (await readState()).grants;
    },
    async revokeGrant(grantId) {
      await requireRole('patient');
      const current = await readState();
      const grant = current.grants.find((item) => item.id === grantId);
      if (!grant || grant.status !== 'active') {
        throw new Error('This access grant is no longer active.');
      }
      const revokedAt = new Date().toISOString();
      await updateState((state) => ({
        ...state,
        grants: state.grants.map((item) =>
          item.id === grantId ? { ...item, status: 'revoked', revokedAt } : item,
        ),
        history: [
          {
            id: id('history'),
            actor: grant.clinicianName,
            organization: grant.organization,
            action: 'Access revoked',
            occurredAt: revokedAt,
            detail: 'The patient ended this grant.',
          },
          ...state.history,
        ],
      }));
      emit({ type: 'access:revoked', requestId: grantId, grantId });
    },
    async getAccessHistory() {
      await requireRole('patient');
      return (await readState()).history;
    },
  },
  clinician: {
    async getDemoPatientQrToken() {
      await requireRole('clinician');
      let state = await readState();
      if (!state.qrToken || new Date(state.qrToken.expiresAt).getTime() <= Date.now()) {
        const token = `hmxqr:v1:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        const nextToken: PatientQrToken = {
          payload: token,
          expiresAt: new Date(Date.now() + QR_TTL_MS).toISOString(),
        };
        state = await updateState((current) => ({ ...current, qrToken: nextToken }));
      }
      return state.qrToken!;
    },
    async resolveQrToken(opaqueToken) {
      await requireRole('clinician');
      if (!opaqueToken.startsWith('hmxqr:v1:')) {
        throw new Error('This is not a HackMatrix temporary QR token.');
      }
      const state = await readState();
      if (
        !state.qrToken ||
        state.qrToken.payload !== opaqueToken ||
        new Date(state.qrToken.expiresAt).getTime() <= Date.now()
      ) {
        throw new Error('This QR token is invalid or expired. Ask the patient to refresh it.');
      }
      const request = {
        id: id('request'),
        patientId: DEMO_PATIENT_ID,
        clinicianId: DEMO_CLINICIAN_ID,
        clinicianName: 'Dr. Maya Chen',
        organization: 'Harbor Health Clinic',
        scopes: ['Conditions', 'Encounters', 'Prescriptions'] as AccessScope[],
        durationMinutes: 60,
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
      };
      await updateState((current) => ({
        ...current,
        requests: [request, ...current.requests],
      }));
      emit({ type: 'access:requested', requestId: request.id });
      return request;
    },
    async getAccessRequest(requestId) {
      await requireRole('clinician');
      return (await readState()).requests.find((request) => request.id === requestId) ?? null;
    },
    async getAuthorizedPatient(patientId) {
      await requireRole('clinician');
      const state = await readState();
      const grant = activeGrant(state);
      if (!grant || grant.patientId !== patientId) return null;
      return {
        patient: state.patient,
        grant,
        conditions: grant.scopes.includes('Conditions') ? state.conditions : [],
        encounters: grant.scopes.includes('Encounters') ? state.encounters : [],
        prescriptions: grant.scopes.includes('Prescriptions') ? state.prescriptions : [],
        observations: grant.scopes.includes('Observations') ? state.observations : [],
      };
    },
    async createEncounter(input: Pick<Encounter, 'diagnosis' | 'reason' | 'date'> & { patientId: string }) {
      await requireRole('clinician');
      if (input.patientId !== DEMO_PATIENT_ID) throw new Error('The demo grant does not cover this patient.');
      const state = await readState();
      requireScope(state, 'Encounters');
      const encounter: Encounter = {
        ...input,
        id: id('encounter'),
        clinicianName: 'Dr. Maya Chen',
        organization: 'Harbor Health Clinic',
      };
      await updateState((current) => ({
        ...current,
        encounters: [encounter, ...current.encounters],
      }));
      return encounter;
    },
    async createPrescription(input: Pick<Prescription, 'drug' | 'dose' | 'frequency' | 'start' | 'end'> & { patientId: string }) {
      await requireRole('clinician');
      if (input.patientId !== DEMO_PATIENT_ID) throw new Error('The demo grant does not cover this patient.');
      const state = await readState();
      requireScope(state, 'Prescriptions');
      const prescription: Prescription = {
        ...input,
        id: id('prescription'),
        clinicianName: 'Dr. Maya Chen',
      };
      await updateState((current) => ({
        ...current,
        prescriptions: [prescription, ...current.prescriptions],
      }));
      return prescription;
    },
    async createObservation(input: Pick<Observation, 'title' | 'value' | 'unit' | 'date'> & { patientId: string }) {
      await requireRole('clinician');
      if (input.patientId !== DEMO_PATIENT_ID) throw new Error('The demo grant does not cover this patient.');
      const state = await readState();
      requireScope(state, 'Observations');
      const observation: Observation = {
        ...input,
        id: id('observation'),
        clinicianName: 'Dr. Maya Chen',
      };
      await updateState((current) => ({
        ...current,
        observations: [observation, ...current.observations],
      }));
      return observation;
    },
  },
  realtime: {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
};