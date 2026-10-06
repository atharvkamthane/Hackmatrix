import { createClerkClient } from "@clerk/backend";
import type { Request, RequestHandler } from "express";
import type { AppConfig } from "../config/env";
import { normalizeIdentity } from "./role-resolution";
import type { AuthenticatedUser, VerifiedClerkIdentity } from "./types";

export type VerifyClerkRequest = (
  req: Request,
) => Promise<VerifiedClerkIdentity | null>;

function readClaim(claims: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)[key]
      : undefined;
  }, claims);
}

export function createClerkVerifier(config: AppConfig): VerifyClerkRequest {
  if (!config.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required to create Clerk authentication.");
  }
  const clerkClient = createClerkClient({
    secretKey: config.CLERK_SECRET_KEY,
    publishableKey: config.CLERK_PUBLISHABLE_KEY,
  });
  return async (req) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(", "));
    }
    const request = new Request(
      `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      { method: req.method, headers },
    );
    const requestState = await clerkClient.authenticateRequest(request, {
      authorizedParties: config.clerkAuthorizedParties.length
        ? config.clerkAuthorizedParties
        : undefined,
    });
    if (!requestState.isAuthenticated) return null;

    const auth = requestState.toAuth();
    const claims = auth.sessionClaims as Record<string, unknown>;
    return {
      userId: auth.userId,
      roleClaim: readClaim(claims, config.CLERK_ROLE_CLAIM),
      organizationId: typeof claims.org_id === "string" ? claims.org_id : null,
    };
  };
}

export function createAuthMiddleware(
  verify: VerifyClerkRequest,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const verified = await verify(req);
      if (!verified) {
        res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required.",
            requestId: req.requestId,
          },
        });
        return;
      }
      try {
        req.auth = normalizeIdentity(verified);
      } catch {
        res.status(403).json({
          error: {
            code: "ROLE_NOT_ASSIGNED",
            message: "The authenticated user does not have a valid server-assigned role.",
            requestId: req.requestId,
          },
        });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export type { AuthenticatedUser };
