import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DemoAccessOverview } from './contracts';
import type {
  AccessHistoryEntry,
  AccessRequest,
  AuthorizedPatient,
  DemoState,
  Encounter,
  Observation,
  PatientProfile,
  PatientQrToken,
  Prescription,
} from '@/src/types/models';
import { apiFetch } from './api';

const AUTH_MODE_KEY = 'hackmatrix.auth.mode.v2';

async function getJSON<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  return await response.json() as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await response.json() as T;
}

export const remoteServices = {
  async getAccessOverview(): Promise<DemoAccessOverview> {
    return getJSON('/api/access/overview');
  },
  async getMe(): Promise<PatientProfile> {
    return getJSON('/api/patient/me');
  },
  async getRecords(): Promise<Pick<DemoState, 'conditions' | 'encounters' | 'prescriptions' | 'observations'>> {
    return getJSON('/api/patient/records');
  },
  async getQrToken(): Promise<PatientQrToken> {
    return getJSON('/api/patient/qr-token');
  },
  async getAccessRequests(): Promise<AccessRequest[]> {
    return getJSON('/api/patient/access-requests');
  },
  async decideAccessRequest(id: string, decision: 'approved' | 'denied'): Promise<void> {
    await postJSON(`/api/patient/access-requests/${encodeURIComponent(id)}/decision`, { decision });
  },
  async getGrants(): Promise<DemoAccessOverview['grants']> {
    return getJSON('/api/patient/grants');
  },
  async revokeGrant(id: string): Promise<void> {
    await postJSON(`/api/patient/grants/${encodeURIComponent(id)}/revoke`, {});
  },
  async getAccessHistory(): Promise<AccessHistoryEntry[]> {
    const overview = await getJSON<DemoAccessOverview>('/api/access/overview');
    return overview.history;
  },
  async resolveQrToken(token: string): Promise<AccessRequest> {
    return postJSON('/api/clinician/qr/resolve', { token });
  },
  async getAccessRequest(id: string): Promise<AccessRequest | null> {
    return getJSON(`/api/clinician/access-requests/${encodeURIComponent(id)}`);
  },
  async getAuthorizedPatient(patientId?: string): Promise<AuthorizedPatient | null> {
    const path = patientId
      ? `/api/clinician/patients/${encodeURIComponent(patientId)}`
      : '/api/clinician/patients';
    return getJSON(path);
  },
  async createEncounter(input: Pick<Encounter, 'diagnosis' | 'reason' | 'date'> & { patientId: string }): Promise<Encounter> {
    return postJSON('/api/clinician/encounters', input);
  },
  async createPrescription(input: Pick<Prescription, 'drug' | 'dose' | 'frequency' | 'start' | 'end'> & { patientId: string }): Promise<Prescription> {
    return postJSON('/api/clinician/prescriptions', input);
  },
  async createObservation(input: Pick<Observation, 'title' | 'value' | 'unit' | 'date'> & { patientId: string }): Promise<Observation> {
    return postJSON('/api/clinician/observations', input);
  },
};

export async function isDemoSession(): Promise<boolean> {
  return await AsyncStorage.getItem(AUTH_MODE_KEY) === 'demo';
}