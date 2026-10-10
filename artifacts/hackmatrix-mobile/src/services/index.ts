import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockServices } from './mock';
import { isDemoSession, remoteServices } from './remote';

async function useDemo(): Promise<boolean> {
	return isDemoSession();
}

export const services = {
	auth: {
		...mockServices.auth,
		async provisionSelf(input: { role: 'PATIENT' | 'CLINICIAN'; name: string; detail?: string }) {
			return remoteServices.provisionSelf(input);
		},
	},
	patient: {
		async getDemoOverview() {
			return await useDemo() ? mockServices.patient.getDemoOverview() : remoteServices.getAccessOverview();
		},
		async getMe() {
			return await useDemo() ? mockServices.patient.getMe() : remoteServices.getMe();
		},
		async getRecords() {
			return await useDemo() ? mockServices.patient.getRecords() : remoteServices.getRecords();
		},
		async getQrToken() {
			return await useDemo() ? mockServices.patient.getQrToken() : remoteServices.getQrToken();
		},
		async getAccessRequests() {
			return await useDemo() ? mockServices.patient.getAccessRequests() : remoteServices.getAccessRequests();
		},
		async decideAccessRequest(id: string, decision: 'approved' | 'denied') {
			return await useDemo() ? mockServices.patient.decideAccessRequest(id, decision) : remoteServices.decideAccessRequest(id, decision);
		},
		async getGrants() {
			return await useDemo() ? mockServices.patient.getGrants() : remoteServices.getGrants();
		},
		async revokeGrant(id: string) {
			return await useDemo() ? mockServices.patient.revokeGrant(id) : remoteServices.revokeGrant(id);
		},
		async getAccessHistory() {
			return await useDemo() ? mockServices.patient.getAccessHistory() : remoteServices.getAccessHistory();
		},
	},
	clinician: {
		async getMe() {
			return await useDemo()
				? { id: 'clinician-demo-01', name: 'Dr. Maya Chen', organization: 'Harbor Health Clinic', role: 'CLINICIAN' }
				: remoteServices.getClinicianMe();
		},
		async getDemoPatientQrToken() {
			if (!await useDemo()) throw new Error('Demo QR tokens are unavailable in production mode.');
			return mockServices.clinician.getDemoPatientQrToken();
		},
		async resolveQrToken(token: string) {
			return await useDemo() ? mockServices.clinician.resolveQrToken(token) : remoteServices.resolveQrToken(token);
		},
		async getAccessRequest(id: string) {
			return await useDemo() ? mockServices.clinician.getAccessRequest(id) : remoteServices.getAccessRequest(id);
		},
		async getAuthorizedPatient(patientId: string) {
			return await useDemo() ? mockServices.clinician.getAuthorizedPatient(patientId) : remoteServices.getAuthorizedPatient(patientId);
		},
		async createEncounter(input: Parameters<typeof mockServices.clinician.createEncounter>[0]) {
			return await useDemo() ? mockServices.clinician.createEncounter(input) : remoteServices.createEncounter(input);
		},
		async createPrescription(input: Parameters<typeof mockServices.clinician.createPrescription>[0]) {
			return await useDemo() ? mockServices.clinician.createPrescription(input) : remoteServices.createPrescription(input);
		},
		async createObservation(input: Parameters<typeof mockServices.clinician.createObservation>[0]) {
			return await useDemo() ? mockServices.clinician.createObservation(input) : remoteServices.createObservation(input);
		},
		async createCondition(input: { patientId: string; display: string; code?: string; date?: string }) {
			if (await useDemo()) {
				return {
					id: `cond-demo-${Date.now()}`,
					name: input.display,
					status: 'Active' as const,
					since: new Date().getFullYear().toString(),
					note: input.code ?? 'RESP_COVID19',
				};
			}
			return remoteServices.createCondition(input);
		},
	},
	realtime: {
		subscribe(listener: Parameters<typeof mockServices.realtime.subscribe>[0]) {
			let disposed = false;
			let unsubscribe: (() => void) | undefined;
			void AsyncStorage.getItem('hackmatrix.auth.mode.v2').then((mode) => {
				if (!disposed && mode === 'demo') unsubscribe = mockServices.realtime.subscribe(listener);
			});
			return () => {
				disposed = true;
				unsubscribe?.();
			};
		},
	},
};
export type { HackMatrixServices } from './contracts';