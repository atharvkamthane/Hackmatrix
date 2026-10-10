export const roles = ["PATIENT", "CLINICIAN", "ADMIN"] as const;

export type Role = (typeof roles)[number];

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  organizationId: string | null;
}

export interface VerifiedClerkIdentity {
  userId: string;
  roleClaim: unknown;
  organizationId: string | null;
}

export interface InternalUserRecord {
  clerkUserId: string;
  role: Role;
  organizationId: string | null;
  status: "active" | "disabled";
}

export type FindInternalUser = (
  clerkUserId: string,
) => Promise<InternalUserRecord | null>;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

