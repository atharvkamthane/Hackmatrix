import type {
  AccessEvent,
  AccessGrant,
  AccessHistoryEntry,
  AccessRequest,
  AccessScope,
  AuthorizedPatient,
  Condition,
  DemoSession,
  DemoState,
  Encounter,
  Observation,
  PatientProfile,
  PatientQrToken,
  Prescription,
  Role,
} from '@/src/types/models';

export interface AuthenticationService {
  getSession(): Promise<DemoSession | null>;
  signIn(role: Role, customProfile?: { name: string; detail?: string }): Promise<DemoSession>;
  signOut(): Promise<void>;
  provisionSelf?(input: { role: 'PATIENT' | 'CLINICIAN'; name: string; detail?: string }): Promise<{ success: boolean; message: string; user: any }>;
}

export interface DemoAccessOverview {
  requests: AccessRequest[];
  grants: AccessGrant[];
  history: AccessHistoryEntry[];
}

export interface PatientService {
  getDemoOverview(): Promise<DemoAccessOverview>;
  getMe(): Promise<PatientProfile>;
  getRecords(): Promise<Pick<DemoState, 'conditions' | 'encounters' | 'prescriptions' | 'observations'>>;
  getQrToken(): Promise<PatientQrToken>;
  getAccessRequests(): Promise<AccessRequest[]>;
  decideAccessRequest(id: string, decision: 'approved' | 'denied'): Promise<void>;
  getGrants(): Promise<AccessGrant[]>;
  revokeGrant(id: string): Promise<void>;
  getAccessHistory(): Promise<AccessHistoryEntry[]>;
}

export interface ClinicianService {
  getMe?(): Promise<{ id: string; name: string; professionalId?: string; organization: string; role: string }>;
  getDemoPatientQrToken(): Promise<PatientQrToken>;
  resolveQrToken(opaqueToken: string): Promise<AccessRequest>;
  getAccessRequest(id: string): Promise<AccessRequest | null>;
  getAuthorizedPatient(patientId: string): Promise<AuthorizedPatient | null>;
  createEncounter(input: Pick<Encounter, 'diagnosis' | 'reason' | 'date'> & { patientId: string }): Promise<Encounter>;
  createPrescription(input: Pick<Prescription, 'drug' | 'dose' | 'frequency' | 'start' | 'end'> & { patientId: string }): Promise<Prescription>;
  createObservation(input: Pick<Observation, 'title' | 'value' | 'unit' | 'date'> & { patientId: string }): Promise<Observation>;
  createCondition?(input: { patientId: string; display: string; code?: string; date?: string }): Promise<Condition>;
}

export interface RealtimeService {
  subscribe(listener: (event: AccessEvent) => void): () => void;
}

export interface HackMatrixServices {
  auth: AuthenticationService;
  patient: PatientService;
  clinician: ClinicianService;
  realtime: RealtimeService;
}