import { isRole, type Role, type VerifiedClerkIdentity } from "./types";

export function resolveRole(roleClaim: unknown): Role {
  if (!isRole(roleClaim)) {
    throw new Error("Authenticated user does not have a valid server-assigned role.");
  }
  return roleClaim;
}

export function normalizeIdentity(
  identity: VerifiedClerkIdentity,
): { userId: string; role: Role; organizationId: string | null } {
  if (!identity.userId) {
    throw new Error("Authenticated identity is missing a user ID.");
  }
  return {
    userId: identity.userId,
    role: resolveRole(identity.roleClaim),
    organizationId: identity.organizationId,
  };
}
