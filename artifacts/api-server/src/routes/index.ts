import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createReadinessRouter } from "./readiness";
import { createAdminAnalyticsRouter } from "./admin-analytics";
import { createClinicalRouter } from "./clinical";
import type { DatabaseConnections } from "../db";
import {
  createAuthMiddleware,
  requireAuth,
  requireOrganizationParam,
  requireRole,
  type FindInternalUser,
  type VerifyClerkRequest,
} from "../auth";

export function createApiRouter(
  connections: DatabaseConnections | undefined,
  verifyClerkRequest: VerifyClerkRequest,
  findInternalUser?: FindInternalUser,
): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);
  router.use(createReadinessRouter(connections));
  const auth = createAuthMiddleware(verifyClerkRequest, findInternalUser);
  router.use("/admin", auth, requireRole("ADMIN"), createAdminAnalyticsRouter(connections));
  router.use(createClinicalRouter(connections, auth));

  router.get("/auth/me", auth, requireAuth(), (req, res) => {
    const capabilities = {
      PATIENT: ["clinical:read:self", "consent:manage:self", "qr:create:self"],
      CLINICIAN: ["clinical:read:granted", "clinical:write:granted", "access:request"],
      ADMIN: ["analytics:read", "audit:read", "security:read"],
    } as const;
    const role = req.auth?.role;
    res.json({
      userId: req.auth?.userId,
      role,
      organizationId: req.auth?.organizationId,
      capabilities: role ? capabilities[role] : [],
    });
  });
  router.get("/auth/test/patient", auth, requireRole("PATIENT"), (_req, res) => {
    res.json({ status: "ok", role: "PATIENT" });
  });
  router.get("/auth/test/clinician", auth, requireRole("CLINICIAN"), (_req, res) => {
    res.json({ status: "ok", role: "CLINICIAN" });
  });
  router.get("/auth/test/admin", auth, requireRole("ADMIN"), (_req, res) => {
    res.json({ status: "ok", role: "ADMIN" });
  });
  router.get(
    "/auth/test/organization/:organizationId",
    auth,
    requireAuth(),
    requireOrganizationParam("organizationId"),
    (_req, res) => res.json({ status: "ok" }),
  );

  return router;
}

export default createApiRouter;

