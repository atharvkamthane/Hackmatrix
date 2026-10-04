import type { RequestHandler } from "express";
import type { Role } from "./types";

function denyUnauthenticated(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]): boolean {
  if (req.auth) return false;
  res.status(401).json({
    error: {
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
      requestId: req.requestId,
    },
  });
  return true;
}

export function requireAuth(): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      denyUnauthenticated(req, _res);
      return;
    }
    next();
  };
}

export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    if (denyUnauthenticated(req, res)) return;
    if (req.auth?.role !== role) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource.",
          requestId: req.requestId,
        },
      });
      return;
    }
    next();
  };
}

export function requireOrganizationParam(
  parameterName: string,
): RequestHandler {
  return (req, res, next) => {
    if (denyUnauthenticated(req, res)) return;
    if (
      !req.auth?.organizationId ||
      req.params[parameterName] !== req.auth.organizationId
    ) {
      res.status(403).json({
        error: {
          code: "ORGANIZATION_FORBIDDEN",
          message: "You do not have access to this organization.",
          requestId: req.requestId,
        },
      });
      return;
    }
    next();
  };
}
