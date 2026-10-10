import { getClerkInstance } from '@clerk/expo';

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5000').replace(/\/$/, '');

export type ServerRole = 'PATIENT' | 'CLINICIAN' | 'ADMIN';

export interface AuthenticatedIdentity {
  userId: string;
  role: ServerRole;
  organizationId: string | null;
}

interface ApiErrorBody {
  error?: { message?: string };
}

/**
 * The single mobile HTTP boundary. It always obtains the token from Clerk at
 * request time, so callers cannot supply or persist their own bearer token.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  let clerk;
  try {
    clerk = getClerkInstance();
  } catch {
    throw new Error('Clerk authentication is not configured in this mobile client.');
  }
  const session = clerk?.session;
  if (!session) {
    throw new Error('No active Clerk session found. Please sign in with your credentials.');
  }
  const token = await session.getToken();
  if (!token) {
    throw new Error('Unable to obtain Clerk authorization token. Please sign in again.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null;
    throw new Error(body?.error?.message ?? `Request failed (${response.status}).`);
  }
  return response;
}

export async function getAuthenticatedIdentity(): Promise<AuthenticatedIdentity> {
  const response = await apiFetch('/api/auth/me');
  const identity = await response.json() as AuthenticatedIdentity;
  if (!identity.userId || !['PATIENT', 'CLINICIAN', 'ADMIN'].includes(identity.role)) {
    throw new Error('The server returned an invalid authorization profile.');
  }
  return identity;
}
