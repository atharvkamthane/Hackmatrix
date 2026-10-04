export type Role = 'patient' | 'clinician';

export type AccessScope =
  | 'Conditions'
  | 'Encounters'
  | 'Prescriptions'
  | 'Observations';

export type RequestStatus = 'pending' | 'approved' | 'denied';

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  bloodType: string;
  memberSince: string;
}

export interface Condition {
  id: string;
  name: string;
  status: 'Active' | 'Resolved';
  since: string;
  note: string;
}

export interface Encounter {
  id: string;
  diagnosis: string;
  reason: string;
  date: string;
  clinicianName: string;
  organization: string;
}

export interface Prescription {
  id: string;
  drug: string;
  dose: string;
  frequency: string;
  start: string;
  end: string;
  clinicianName: string;
}

export interface Observation {
  id: string;
  title: string;
  value: string;
  unit: string;
  date: string;
  clinicianName: string;
}

export interface AccessRequest {
  id: string;
  patientId: string;
  clinicianId: string;
  clinicianName: string;
  organization: string;
  scopes: AccessScope[];
  durationMinutes: number;
  createdAt: string;
  status: RequestStatus;
  decidedAt?: string;
}

export interface AccessGrant {
  id: string;
  patientId: string;
  clinicianId: string;
  clinicianName: string;
  organization: string;
  scopes: AccessScope[];
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'revoked';
  revokedAt?: string;
}

export interface AccessHistoryEntry {
  id: string;
  actor: string;
  organization: string;
  action: string;
  occurredAt: string;
  detail: string;
}

export interface PatientQrToken {
  payload: string;
  expiresAt: string;
}

export interface DemoState {
  patient: PatientProfile;
  conditions: Condition[];
  encounters: Encounter[];
  prescriptions: Prescription[];
  observations: Observation[];
  requests: AccessRequest[];
  grants: AccessGrant[];
  history: AccessHistoryEntry[];
  qrToken?: PatientQrToken;
}

export interface AuthorizedPatient {
  patient: PatientProfile;
  grant: AccessGrant;
  conditions: Condition[];
  encounters: Encounter[];
  prescriptions: Prescription[];
  observations: Observation[];
}

export interface DemoSession {
  role: Role;
}

export interface AccessEvent {
  type: 'access:requested' | 'access:decided' | 'access:revoked';
  requestId: string;
  status?: RequestStatus;
  grantId?: string;
}