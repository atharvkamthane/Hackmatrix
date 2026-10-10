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

  // Self-provisioning endpoint for authenticated Clerk users in non-production / test mode
  router.post("/auth/provision-self", async (req, res, next) => {
    try {
      const verified = await verifyClerkRequest(req);
      if (!verified) {
        return res.status(401).json({
          error: { code: "UNAUTHENTICATED", message: "Authentication is required to provision account." },
        });
      }

      if (!connections?.clinical || typeof (connections.clinical as any).model !== "function") {
        return res.status(503).json({
          error: { code: "DATABASE_UNAVAILABLE", message: "Clinical database is not connected." },
        });
      }

      const { createClinicalModels } = await import("../models/clinical");
      const models = createClinicalModels(connections.clinical);

      const existing = await models.User.findOne({ clerkUserId: verified.userId }).lean().exec();
      if (existing) {
        return res.status(409).json({
          error: { code: "ALREADY_PROVISIONED", message: "User account is already provisioned in the clinical directory." },
        });
      }

      const requestedRole = req.body?.role;
      if (requestedRole !== "PATIENT" && requestedRole !== "CLINICIAN") {
        return res.status(400).json({
          error: { code: "INVALID_ROLE", message: "Self-provisioning role must be either PATIENT or CLINICIAN." },
        });
      }

      const rawName = (typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "") ||
        (typeof req.body?.name === "string" ? req.body.name.trim() : "");
      if (rawName.length < 2 || rawName.length > 100) {
        return res.status(400).json({
          error: { code: "INVALID_NAME", message: "A valid display name between 2 and 100 characters is required." },
        });
      }

      let org = await models.Organization.findOne({ name: "Harbor Health Clinic" });
      if (!org) {
        org = await models.Organization.create({
          name: "Harbor Health Clinic",
          regionId: "reg_mh",
          stateName: "Maharashtra",
          districtName: "Pune District",
          status: "active",
        });
      }

      const user = await models.User.create({
        clerkUserId: verified.userId,
        role: requestedRole,
        organizationId: org._id,
        status: "active",
      });

      let profileResult: { id: string; name: string };

      if (requestedRole === "PATIENT") {
        const dob = req.body?.dateOfBirth && !Number.isNaN(new Date(req.body.dateOfBirth).getTime())
          ? new Date(req.body.dateOfBirth)
          : new Date("1995-01-01");
        const patient = await models.Patient.create({
          userId: user._id,
          organizationId: org._id,
          displayName: rawName,
          dateOfBirth: dob,
          identityStatus: "active",
        });
        profileResult = { id: patient._id.toString(), name: patient.displayName };
      } else {
        const professionalId = typeof req.body?.professionalId === "string" && req.body.professionalId.trim()
          ? req.body.professionalId.trim()
          : `MED-${Math.floor(10000 + Math.random() * 90000)}`;
        const clinicianName = rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`;
        const clinician = await models.Clinician.create({
          userId: user._id,
          organizationId: org._id,
          displayName: clinicianName,
          professionalId,
          identityStatus: "active",
        });
        profileResult = { id: clinician._id.toString(), name: clinician.displayName };
      }

      await models.AuditLog.create({
        actorUserId: verified.userId,
        actorRole: requestedRole,
        organizationId: org._id,
        action: "USER_SELF_PROVISIONED",
        resourceType: "User",
        resourceReference: user._id.toString(),
        result: "SUCCESS",
        correlationId: req.requestId ?? "unavailable",
      });

      return res.status(201).json({
        status: "PROVISIONED",
        userId: verified.userId,
        role: requestedRole,
        organizationId: org._id.toString(),
        organizationName: org.name,
        profile: profileResult,
      });
    } catch (err) {
      next(err);
    }
  });

  // Admin-authorized provisioning endpoint
  router.post("/admin/provision-user", auth, requireRole("ADMIN"), async (req, res, next) => {
    try {
      if (!connections?.clinical || typeof (connections.clinical as any).model !== "function") {
        return res.status(503).json({
          error: { code: "DATABASE_UNAVAILABLE", message: "Clinical database is not connected." },
        });
      }

      const { clerkUserId, role, displayName, dateOfBirth, professionalId, organizationId } = req.body;
      if (!clerkUserId || typeof clerkUserId !== "string" || !["PATIENT", "CLINICIAN", "ADMIN"].includes(role)) {
        return res.status(400).json({
          error: { code: "INVALID_INPUT", message: "Valid clerkUserId and role are required." },
        });
      }

      const { createClinicalModels } = await import("../models/clinical");
      const models = createClinicalModels(connections.clinical);

      const existing = await models.User.findOne({ clerkUserId }).lean().exec();
      if (existing) {
        return res.status(409).json({
          error: { code: "ALREADY_PROVISIONED", message: "User account already exists." },
        });
      }

      let orgId = organizationId;
      if (!orgId) {
        let org = await models.Organization.findOne({ name: "Harbor Health Clinic" });
        if (!org) {
          org = await models.Organization.create({
            name: "Harbor Health Clinic",
            regionId: "reg_mh",
            stateName: "Maharashtra",
            districtName: "Pune District",
            status: "active",
          });
        }
        orgId = org._id;
      }

      const user = await models.User.create({
        clerkUserId,
        role,
        organizationId: orgId,
        status: "active",
      });

      const name = typeof displayName === "string" && displayName.trim() ? displayName.trim() : "Healthcare User";

      if (role === "PATIENT") {
        const dob = dateOfBirth ? new Date(dateOfBirth) : new Date("1995-01-01");
        await models.Patient.create({
          userId: user._id,
          organizationId: orgId,
          displayName: name,
          dateOfBirth: dob,
          identityStatus: "active",
        });
      } else if (role === "CLINICIAN") {
        const profId = professionalId || `MED-${Math.floor(10000 + Math.random() * 90000)}`;
        await models.Clinician.create({
          userId: user._id,
          organizationId: orgId,
          displayName: name.startsWith("Dr.") ? name : `Dr. ${name}`,
          professionalId: profId,
          identityStatus: "active",
        });
      }

      return res.status(201).json({
        status: "PROVISIONED",
        userId: clerkUserId,
        role,
        organizationId: orgId.toString(),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createApiRouter;

