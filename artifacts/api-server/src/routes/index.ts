import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createReadinessRouter } from "./readiness";
import adminRouter from "./admin";
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
  router.use("/admin", adminRouter);

  const auth = createAuthMiddleware(verifyClerkRequest, findInternalUser);
  router.get("/auth/me", auth, requireAuth(), (req, res) => {
    res.json({
      userId: req.auth?.userId,
      role: req.auth?.role,
      organizationId: req.auth?.organizationId,
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

