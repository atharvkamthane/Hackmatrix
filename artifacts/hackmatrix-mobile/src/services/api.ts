import { getClerkInstance } from '@clerk/expo';

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5000').replace(/\/$/, '');

export type ServerRole = 'PATIENT' | 'CLINICIAN' | 'ADMIN';

export interface AuthenticatedIdentity {
  userId: string;
  role: ServerRole;
  organizationId: string | null;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: { message?: string; code?: string };
  message?: string;
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
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiErrorBody | null;
    const msg = body?.error?.message ?? body?.message ?? `Request failed (${response.status}).`;
    const code = body?.error?.code;
    throw new ApiError(msg, response.status, code);
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

