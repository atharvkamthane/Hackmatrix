import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import { Types } from "mongoose";
import type { DatabaseConnections } from "../db";
import { createClinicalModels, clinicalScopes, type ClinicalScope } from "../models/clinical";
import { requireRole, type Role } from "../auth";

const QR_TTL_MS = 60 * 1000;
const REQUEST_TTL_MS = 2 * 60 * 1000;
export const PERMITTED_DURATIONS = [15, 30, 60] as const;
const DEFAULT_GRANT_MINUTES = 60;
const MAX_LIST_SIZE = 100;
const scopeLabels: Record<ClinicalScope, string[]> = {
  visits: ["Conditions", "Encounters"],
  prescriptions: ["Prescriptions"],
  labs: ["Observations"],
};

function isDatabaseConnection(value: unknown): value is { model: (...args: unknown[]) => unknown } {
  return Boolean(value && typeof (value as { model?: unknown }).model === "function");
}

function responseError(res: Parameters<RequestHandler>[1], status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function requiredText(body: unknown, key: string, maxLength: number): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength
    ? value.trim()
    : null;
}

function routeParam(req: Request, key: string): string | null {
  const value = req.params[key];
  return typeof value === "string" ? value : null;
}

function scopeNames(scopes: readonly ClinicalScope[]): string[] {
  return [...new Set(scopes.flatMap((scope) => scopeLabels[scope]))];
}

function requestStatus(status: string): "pending" | "approved" | "denied" {
  if (status === "APPROVED") return "approved";
  if (status === "DENIED" || status === "EXPIRED") return "denied";
  return "pending";
}

function mapPatient(patient: {
  _id: Types.ObjectId;
  displayName: string;
  dateOfBirth: Date;
  createdAt?: Date;
}) {
  const now = new Date();
  const birth = new Date(patient.dateOfBirth);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return {
    id: patient._id.toString(),
    name: patient.displayName,
    age: Math.max(0, age),
    bloodType: "Not recorded",
    memberSince: String((patient.createdAt ?? now).getUTCFullYear()),
  };
}

function toUiRequest(request: {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  clinicianId: Types.ObjectId;
  requestedScopes: ClinicalScope[];
  requestedDurationMinutes: number;
  createdAt: Date;
  status: string;
  decidedAt?: Date | null;
}, patientName: string, clinicianName: string, organization: string) {
  return {
    id: request._id.toString(),
    patientId: request.patientId.toString(),
    clinicianId: request.clinicianId.toString(),
    clinicianName,
    organization,
    scopes: scopeNames(request.requestedScopes),
    durationMinutes: request.requestedDurationMinutes,
    createdAt: request.createdAt.toISOString(),
    status: requestStatus(request.status),
    ...(request.decidedAt ? { decidedAt: request.decidedAt.toISOString() } : {}),
  };
}

function toUiGrant(grant: {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  clinicianId: Types.ObjectId;
  scopes: ClinicalScope[];
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
  status: string;
}, clinicianName: string, organization: string) {
  return {
    id: grant._id.toString(),
    patientId: grant.patientId.toString(),
    clinicianId: grant.clinicianId.toString(),
    clinicianName,
    organization,
    scopes: scopeNames(grant.scopes),
    createdAt: grant.issuedAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    status: grant.status === "ACTIVE" && grant.expiresAt > new Date() ? "active" : "revoked",
    ...(grant.revokedAt ? { revokedAt: grant.revokedAt.toISOString() } : {}),
  };
}

export function createClinicalRouter(
  connections: DatabaseConnections | undefined,
  auth: RequestHandler,
): IRouter {
  const router: IRouter = Router();
  if (!connections || !isDatabaseConnection(connections.clinical)) {
    router.use("/patient", auth, requireRole("PATIENT"), (_req, res) => responseError(res, 503, "DATABASE_UNAVAILABLE", "Clinical data is unavailable."));
    router.use("/clinician", auth, requireRole("CLINICIAN"), (_req, res) => responseError(res, 503, "DATABASE_UNAVAILABLE", "Clinical data is unavailable."));
    router.use("/access", auth, (req, res, next) => {
      if (req.auth?.role !== "PATIENT" && req.auth?.role !== "CLINICIAN") {
        responseError(res, 403, "FORBIDDEN", "This role cannot use clinical access workflows.");
        return;
      }
      next();
    }, (_req, res) => responseError(res, 503, "DATABASE_UNAVAILABLE", "Access data is unavailable."));
    return router;
  }

  const models = createClinicalModels(connections.clinical);

  const findUser = async (req: Request, role?: Role) => {
    if (!req.auth) return null;
    return models.User.findOne({
      clerkUserId: req.auth.userId,
      status: "active",
      ...(role ? { role } : {}),
    }).lean().exec();
  };

  const findPatientForUser = async (user: NonNullable<Awaited<ReturnType<typeof findUser>>>) =>
    models.Patient.findOne({ userId: user._id, organizationId: user.organizationId, identityStatus: "active" }).lean().exec();

  const findClinicianForUser = async (user: NonNullable<Awaited<ReturnType<typeof findUser>>>) =>
    models.Clinician.findOne({ userId: user._id, organizationId: user.organizationId, identityStatus: "active" }).lean().exec();

  const organizationName = async (organizationId: Types.ObjectId) => {
    const organization = await models.Organization.findById(organizationId).select("name").lean().exec();
    return organization?.name ?? "Organization";
  };

  const writeAudit = async (
    req: Request,
    user: { clerkUserId: string; role: Role; organizationId: Types.ObjectId },
    action: string,
    resourceType: string,
    resourceReference: string,
    result: "SUCCESS" | "DENIED" | "FAILURE" = "SUCCESS",
  ) => {
    await models.AuditLog.create({
      actorUserId: user.clerkUserId,
      actorRole: user.role,
      organizationId: user.organizationId,
      action,
      resourceType,
      resourceReference,
      result,
      correlationId: req.requestId ?? "unavailable",
    });
  };

  const accessOverview = async (req: Request, res: Parameters<RequestHandler>[1]) => {
    if (!req.auth) return responseError(res, 401, "UNAUTHENTICATED", "Authentication is required.");
    const user = await findUser(req);
    if (!user) return responseError(res, 403, "USER_NOT_PROVISIONED", "No active account is assigned to this identity.");
    const isPatient = user.role === "PATIENT";
    const patient = isPatient ? await findPatientForUser(user) : null;
    const clinician = user.role === "CLINICIAN" ? await findClinicianForUser(user) : null;
    const ownerId = patient?._id ?? clinician?._id;
    if (!ownerId) return responseError(res, 403, "PROFILE_NOT_PROVISIONED", "The clinical profile is not provisioned.");

    const filter = isPatient
      ? { patientId: ownerId, organizationId: user.organizationId }
      : { clinicianId: ownerId, organizationId: user.organizationId };
    const [requests, grants, events, organization] = await Promise.all([
      models.AccessRequest.find(filter).sort({ createdAt: -1 }).limit(MAX_LIST_SIZE).lean().exec(),
      models.AccessGrant.find(filter).sort({ issuedAt: -1 }).limit(MAX_LIST_SIZE).lean().exec(),
      isPatient
        ? models.AuditLog.find({ organizationId: user.organizationId, resourceType: "Patient", resourceReference: patient!._id.toString() }).sort({ occurredAt: -1 }).limit(MAX_LIST_SIZE).lean().exec()
        : Promise.resolve([]),
      organizationName(user.organizationId),
    ]);
    const clinicianIds = [...new Set([...requests.map((item) => item.clinicianId.toString()), ...grants.map((item) => item.clinicianId.toString())])]
      .filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const clinicians = await models.Clinician.find({ _id: { $in: clinicianIds }, organizationId: user.organizationId }).select("displayName").lean().exec();
    const clinicianNames = new Map(clinicians.map((item) => [item._id.toString(), item.displayName]));
    const result = {
      requests: requests.map((item) => toUiRequest(item, patient?.displayName ?? "Authorized patient", clinicianNames.get(item.clinicianId.toString()) ?? "Clinician", organization)),
      grants: grants.map((item) => toUiGrant(item, clinicianNames.get(item.clinicianId.toString()) ?? "Clinician", organization)),
      history: events.map((event) => ({
        id: event._id.toString(),
        actor: event.actorRole === "CLINICIAN" ? "Clinician" : "Patient",
        organization,
        action: event.action.replaceAll("_", " ").toLowerCase(),
        occurredAt: event.occurredAt.toISOString(),
        detail: "A consent and access event was recorded.",
      })),
    };
    return res.json(result);
  };

  router.get("/access/overview", auth, async (req, res, next) => {
    try {
      if (!req.auth) return responseError(res, 401, "UNAUTHENTICATED", "Authentication is required.");
      if (req.auth.role !== "PATIENT" && req.auth.role !== "CLINICIAN") {
        return responseError(res, 403, "FORBIDDEN", "This role cannot use clinical access workflows.");
      }
      return await accessOverview(req, res);
    } catch (error) {
      next(error);
    }
  });

  router.get("/patient/me", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      await writeAudit(req, user, "PATIENT_PROFILE_READ", "Patient", patient._id.toString());
      return res.json(mapPatient(patient));
    } catch (error) {
      next(error);
    }
  });

  const loadPatientRecords = async (patientId: Types.ObjectId, organizationId: Types.ObjectId, clinicianAccess?: { clinicianId: Types.ObjectId; scopes: ClinicalScope[] }) => {
    const scopes = clinicianAccess?.scopes ?? clinicalScopes;
    const includeVisits = scopes.includes("visits");
    const includePrescriptions = scopes.includes("prescriptions");
    const includeLabs = scopes.includes("labs");
    const [conditions, encounters, prescriptions, observations] = await Promise.all([
      includeVisits ? models.Condition.find({ patientId, organizationId }).sort({ onsetDate: -1 }).limit(MAX_LIST_SIZE).lean().exec() : [],
      includeVisits ? models.Encounter.find({ patientId, organizationId }).sort({ startedAt: -1 }).limit(MAX_LIST_SIZE).lean().exec() : [],
      includePrescriptions ? models.MedicationRequest.find({ patientId, organizationId }).sort({ authoredOn: -1 }).limit(MAX_LIST_SIZE).lean().exec() : [],
      includeLabs ? models.Observation.find({ patientId, organizationId }).sort({ observedAt: -1 }).limit(MAX_LIST_SIZE).lean().exec() : [],
    ]);
    return {
      conditions: conditions.map((item) => ({
        id: item._id.toString(),
        name: item.display,
        status: item.clinicalStatus === "resolved" ? "Resolved" : "Active",
        since: String((item.onsetDate ?? item.createdAt).getUTCFullYear()),
        note: item.code,
      })),
      encounters: encounters.map((item) => ({
        id: item._id.toString(),
        diagnosis: item.diagnosis ?? "Not recorded",
        reason: item.reason ?? "",
        date: item.startedAt.toISOString().slice(0, 10),
        clinicianName: "Clinician",
        organization: "Organization",
      })),
      prescriptions: prescriptions.map((item) => ({
        id: item._id.toString(),
        drug: item.medication,
        dose: item.dosageInstruction,
        frequency: item.dosageInstruction,
        start: item.authoredOn.toISOString().slice(0, 10),
        end: item.endsOn?.toISOString().slice(0, 10) ?? null,
        clinicianName: "Clinician",
      })),
      observations: observations.map((item) => ({
        id: item._id.toString(),
        title: item.display,
        value: item.value,
        unit: item.unit ?? "",
        date: item.observedAt.toISOString().slice(0, 10),
        clinicianName: "Clinician",
      })),
    };
  };

  router.get("/patient/records", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      const records = await loadPatientRecords(patient._id, user.organizationId);
      await writeAudit(req, user, "PATIENT_RECORDS_READ", "Patient", patient._id.toString());
      return res.json(records);
    } catch (error) {
      next(error);
    }
  });

  router.get("/patient/qr-token", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      const now = new Date();
      await models.QRToken.updateMany({ patientId: patient._id, usedAt: { $exists: false }, revokedAt: { $exists: false }, expiresAt: { $gt: now } }, { $set: { revokedAt: now } });
      const token = `hmxqr:v1:${randomBytes(32).toString("base64url")}`;
      const expiresAt = new Date(now.getTime() + QR_TTL_MS);
      await models.QRToken.create({
        tokenHash: createHash("sha256").update(token).digest("hex"),
        patientId: patient._id,
        expiresAt,
        createdByUserId: user._id,
        creationIp: req.ip,
        creationUserAgent: req.get("user-agent")?.slice(0, 512),
      });
      await writeAudit(req, user, "PATIENT_QR_CREATED", "Patient", patient._id.toString());
      return res.json({ payload: token, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/patient/access-requests", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      const requests = await models.AccessRequest.find({ patientId: patient._id, organizationId: user.organizationId }).sort({ createdAt: -1 }).limit(MAX_LIST_SIZE).lean().exec();
      const [clinicians, organization] = await Promise.all([
        models.Clinician.find({ _id: { $in: requests.map((request) => request.clinicianId) }, organizationId: user.organizationId }).select("displayName").lean().exec(),
        organizationName(user.organizationId),
      ]);
      const names = new Map(clinicians.map((item) => [item._id.toString(), item.displayName]));
      return res.json(requests.map((request) => toUiRequest(request, patient.displayName, names.get(request.clinicianId.toString()) ?? "Clinician", organization)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/patient/access-requests/:requestId/decision", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const decision = req.body?.decision;
      if (decision !== "approved" && decision !== "denied") return responseError(res, 400, "INVALID_DECISION", "Decision must be approved or denied.");
      const requestId = routeParam(req, "requestId");
      if (!requestId || !Types.ObjectId.isValid(requestId)) return responseError(res, 400, "INVALID_REQUEST", "Invalid request identifier.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      const now = new Date();
      const request = await models.AccessRequest.findOne({ _id: req.params.requestId, patientId: patient._id, organizationId: user.organizationId, status: "PENDING" }).exec();
      if (!request) return responseError(res, 404, "REQUEST_NOT_FOUND", "Access request is no longer available.");
      if (request.expiresAt <= now) {
        request.status = "EXPIRED";
        await request.save();
        return responseError(res, 409, "REQUEST_EXPIRED", "This access request has expired.");
      }
      request.status = decision === "approved" ? "APPROVED" : "DENIED";
      request.decidedAt = now;
      request.decision = { decidedByUserId: user._id };
      await request.save();
      let grantId: string | undefined;
      if (decision === "approved") {
        const grant = await models.AccessGrant.create({
          patientId: patient._id,
          clinicianId: request.clinicianId,
          organizationId: user.organizationId,
          scopes: request.requestedScopes,
          issuedAt: now,
          expiresAt: new Date(now.getTime() + request.requestedDurationMinutes * 60_000),
          status: "ACTIVE",
        });
        grantId = grant._id.toString();
      }
      await writeAudit(req, user, decision === "approved" ? "ACCESS_REQUEST_APPROVED" : "ACCESS_REQUEST_DENIED", "Patient", patient._id.toString());
      return res.json({ status: decision, ...(grantId ? { grantId } : {}) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/patient/grants", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      const grants = await models.AccessGrant.find({ patientId: patient._id, organizationId: user.organizationId }).sort({ issuedAt: -1 }).limit(MAX_LIST_SIZE).lean().exec();
      const [clinicians, organization] = await Promise.all([
        models.Clinician.find({ _id: { $in: grants.map((grant) => grant.clinicianId) }, organizationId: user.organizationId }).select("displayName").lean().exec(),
        organizationName(user.organizationId),
      ]);
      const names = new Map(clinicians.map((item) => [item._id.toString(), item.displayName]));
      return res.json(grants.map((grant) => toUiGrant(grant, names.get(grant.clinicianId.toString()) ?? "Clinician", organization)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/patient/grants/:grantId/revoke", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "PATIENT") return responseError(res, 403, "FORBIDDEN", "Patient access is required.");
      const grantId = routeParam(req, "grantId");
      if (!grantId || !Types.ObjectId.isValid(grantId)) return responseError(res, 400, "INVALID_GRANT", "Invalid grant identifier.");
      const user = await findUser(req, "PATIENT");
      const patient = user && await findPatientForUser(user);
      if (!user || !patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "Patient profile is not provisioned.");
      const grant = await models.AccessGrant.findOne({ _id: grantId, patientId: patient._id, organizationId: user.organizationId, status: "ACTIVE" }).exec();
      if (!grant) return responseError(res, 404, "GRANT_NOT_FOUND", "Active access grant was not found.");
      grant.status = "REVOKED";
      grant.revokedAt = new Date();
      await grant.save();
      await writeAudit(req, user, "ACCESS_GRANT_REVOKED", "Patient", patient._id.toString());
      return res.json({ status: "revoked" });
    } catch (error) {
      next(error);
    }
  });

  router.post("/clinician/qr/resolve", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "CLINICIAN") return responseError(res, 403, "FORBIDDEN", "Clinician access is required.");
      const token = requiredText(req.body, "token", 128);
      if (!token) return responseError(res, 400, "INVALID_QR_TOKEN", "A valid temporary QR token is required.");
      const scopeInput = req.body?.scopes;
      const requestedScopes: ClinicalScope[] = scopeInput === undefined
        ? ["visits"]
        : Array.isArray(scopeInput) && scopeInput.length > 0 && scopeInput.length <= clinicalScopes.length &&
          scopeInput.every((scope: unknown): scope is ClinicalScope => typeof scope === "string" && clinicalScopes.includes(scope as ClinicalScope))
          ? [...new Set(scopeInput as ClinicalScope[])]
          : [];
      const durationInput = req.body?.durationMinutes;
      const requestedDurationMinutes = durationInput === undefined ? DEFAULT_GRANT_MINUTES : durationInput;
      if (
        requestedScopes.length === 0 ||
        typeof requestedDurationMinutes !== "number" ||
        !Number.isInteger(requestedDurationMinutes) ||
        !PERMITTED_DURATIONS.includes(requestedDurationMinutes as (typeof PERMITTED_DURATIONS)[number])
      ) {
        return responseError(res, 400, "INVALID_ACCESS_REQUEST", "Choose valid access scopes and a permitted duration of 15, 30, or 60 minutes.");
      }
      const user = await findUser(req, "CLINICIAN");
      const clinician = user && await findClinicianForUser(user);
      if (!user || !clinician) return responseError(res, 404, "CLINICIAN_NOT_FOUND", "Clinician profile is not provisioned.");
      const now = new Date();
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const qrToken = await models.QRToken.findOne({
        tokenHash,
        expiresAt: { $gt: now },
        usedAt: { $exists: false },
        revokedAt: { $exists: false },
      }).lean().exec();
      if (!qrToken) return responseError(res, 404, "QR_TOKEN_INVALID", "This QR token is invalid, expired, revoked, or already used.");
      const qrPatient = await models.Patient.findOne({ _id: qrToken.patientId, identityStatus: "active" }).lean().exec();
      if (!qrPatient) return responseError(res, 404, "PATIENT_NOT_FOUND", "The QR token patient profile is no longer active.");
      if (!qrPatient.organizationId.equals(user.organizationId)) return responseError(res, 403, "ORGANIZATION_FORBIDDEN", "The patient and clinician must belong to the same organization.");
      const consumedToken = await models.QRToken.findOneAndUpdate({
        _id: qrToken._id,
        tokenHash,
        expiresAt: { $gt: new Date() },
        usedAt: { $exists: false },
        revokedAt: { $exists: false },
      }, { $set: { usedAt: new Date() } }, { new: false }).lean().exec();
      if (!consumedToken) return responseError(res, 409, "QR_TOKEN_ALREADY_USED", "This QR token has already been consumed.");
      const accessRequest = await models.AccessRequest.create({
        patientId: qrToken.patientId,
        clinicianId: clinician._id,
        organizationId: user.organizationId,
        requestedScopes,
        requestedDurationMinutes,
        status: "PENDING",
        createdAt: now,
        expiresAt: new Date(now.getTime() + REQUEST_TTL_MS),
      });
      await writeAudit(req, user, "ACCESS_REQUEST_CREATED", "Patient", qrToken.patientId.toString());
      const organization = await organizationName(user.organizationId);
      return res.status(201).json(toUiRequest(accessRequest.toObject(), qrPatient.displayName, clinician.displayName, organization));
    } catch (error) {
      next(error);
    }
  });

  router.get("/clinician/access-requests/:requestId", auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "CLINICIAN") return responseError(res, 403, "FORBIDDEN", "Clinician access is required.");
      const requestId = routeParam(req, "requestId");
      if (!requestId || !Types.ObjectId.isValid(requestId)) return responseError(res, 400, "INVALID_REQUEST", "Invalid request identifier.");
      const user = await findUser(req, "CLINICIAN");
      const clinician = user && await findClinicianForUser(user);
      if (!user || !clinician) return responseError(res, 404, "CLINICIAN_NOT_FOUND", "Clinician profile is not provisioned.");
      const request = await models.AccessRequest.findOne({ _id: requestId, clinicianId: clinician._id, organizationId: user.organizationId }).lean().exec();
      if (!request) return responseError(res, 404, "REQUEST_NOT_FOUND", "Access request was not found.");
      if (request.status === "PENDING" && request.expiresAt <= new Date()) {
        await models.AccessRequest.updateOne({ _id: request._id, status: "PENDING" }, { $set: { status: "EXPIRED" } });
        request.status = "EXPIRED";
      }
      const [patient, organization] = await Promise.all([
        models.Patient.findById(request.patientId).select("displayName").lean().exec(),
        organizationName(user.organizationId),
      ]);
      return res.json(toUiRequest(request, patient?.displayName ?? "Patient", clinician.displayName, organization));
    } catch (error) {
      next(error);
    }
  });

  router.get(["/clinician/patients", "/clinician/patients/:patientId"], auth, async (req, res, next) => {
    try {
      if (req.auth?.role !== "CLINICIAN") return responseError(res, 403, "FORBIDDEN", "Clinician access is required.");
      const user = await findUser(req, "CLINICIAN");
      const clinician = user && await findClinicianForUser(user);
      if (!user || !clinician) return responseError(res, 404, "CLINICIAN_NOT_FOUND", "Clinician profile is not provisioned.");
      const now = new Date();
      const grantFilter = { clinicianId: clinician._id, organizationId: user.organizationId, status: "ACTIVE", expiresAt: { $gt: now } };
      const patientId = routeParam(req, "patientId");
      if (patientId && !Types.ObjectId.isValid(patientId)) return responseError(res, 400, "INVALID_PATIENT", "Invalid patient identifier.");
      const grant = patientId && Types.ObjectId.isValid(patientId)
        ? await models.AccessGrant.findOne({ ...grantFilter, patientId: new Types.ObjectId(patientId) }).sort({ expiresAt: -1 }).lean().exec()
        : await models.AccessGrant.findOne(grantFilter).sort({ expiresAt: -1 }).lean().exec();
      if (!grant) return res.json(null);
      const patient = await models.Patient.findOne({ _id: grant.patientId, organizationId: user.organizationId, identityStatus: "active" }).lean().exec();
      if (!patient) return res.json(null);
      const records = await loadPatientRecords(patient._id, user.organizationId, { clinicianId: clinician._id, scopes: grant.scopes });
      const organization = await organizationName(user.organizationId);
      await writeAudit(req, user, "CLINICIAN_AUTHORIZED_RECORDS_READ", "Patient", patient._id.toString());
      return res.json({
        patient: mapPatient(patient),
        grant: toUiGrant(grant, clinician.displayName, organization),
        ...records,
      });
    } catch (error) {
      next(error);
    }
  });

  const authorizedWrite = async (req: Request, res: Parameters<RequestHandler>[1], scope: ClinicalScope) => {
    if (req.auth?.role !== "CLINICIAN") return responseError(res, 403, "FORBIDDEN", "Clinician access is required.");
    const patientId = requiredText(req.body, "patientId", 24);
    if (!patientId || !Types.ObjectId.isValid(patientId)) return responseError(res, 400, "INVALID_PATIENT", "A valid patient ID is required.");
    const user = await findUser(req, "CLINICIAN");
    const clinician = user && await findClinicianForUser(user);
    if (!user || !clinician) return responseError(res, 404, "CLINICIAN_NOT_FOUND", "Clinician profile is not provisioned.");
    const grant = await models.AccessGrant.findOne({
      patientId: new Types.ObjectId(patientId),
      clinicianId: clinician._id,
      organizationId: user.organizationId,
      status: "ACTIVE",
      expiresAt: { $gt: new Date() },
      scopes: scope,
    }).sort({ expiresAt: -1 }).exec();
    if (!grant) return responseError(res, 403, "CONSENT_REQUIRED", "No active patient grant includes this record scope.");
    const patient = await models.Patient.findOne({ _id: grant.patientId, organizationId: user.organizationId, identityStatus: "active" }).lean().exec();
    if (!patient) return responseError(res, 404, "PATIENT_NOT_FOUND", "The patient profile is no longer active.");
    return { user, clinician, grant, patient };
  };

  router.post("/clinician/encounters", auth, async (req, res, next) => {
    try {
      const access = await authorizedWrite(req, res, "visits");
      if (!access) return;
      const diagnosis = requiredText(req.body, "diagnosis", 200);
      const reason = requiredText(req.body, "reason", 500);
      const startedAt = toDate(req.body?.date);
      if (!diagnosis || !reason || !startedAt) return responseError(res, 400, "INVALID_ENCOUNTER", "Diagnosis, reason, and a valid date are required.");
      const record = await models.Encounter.create({
        patientId: access.patient._id,
        clinicianId: access.clinician._id,
        organizationId: access.user.organizationId,
        status: "finished",
        diagnosis,
        reason,
        startedAt,
      });
      await writeAudit(req, access.user, "CLINICAL_ENCOUNTER_CREATED", "Patient", access.patient._id.toString());
      const organization = await organizationName(access.user.organizationId);
      return res.status(201).json({ id: record._id.toString(), diagnosis, reason, date: startedAt.toISOString().slice(0, 10), clinicianName: access.clinician.displayName, organization });
    } catch (error) {
      next(error);
    }
  });

  router.post("/clinician/prescriptions", auth, async (req, res, next) => {
    try {
      const access = await authorizedWrite(req, res, "prescriptions");
      if (!access) return;
      const drug = requiredText(req.body, "drug", 200);
      const dose = requiredText(req.body, "dose", 120);
      const frequency = requiredText(req.body, "frequency", 120);
      const start = toDate(req.body?.start);
      const end = toDate(req.body?.end);
      if (!drug || !dose || !frequency || !start || !end || end < start) return responseError(res, 400, "INVALID_PRESCRIPTION", "Valid medication, dose, frequency, and date range are required.");
      const record = await models.MedicationRequest.create({
        patientId: access.patient._id,
        clinicianId: access.clinician._id,
        organizationId: access.user.organizationId,
        medication: drug,
        status: "active",
        authoredOn: start,
        endsOn: end,
        dosageInstruction: `${dose}; ${frequency}`,
      });
      await writeAudit(req, access.user, "CLINICAL_PRESCRIPTION_CREATED", "Patient", access.patient._id.toString());
      return res.status(201).json({ id: record._id.toString(), drug, dose, frequency, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), clinicianName: access.clinician.displayName });
    } catch (error) {
      next(error);
    }
  });

  router.post("/clinician/observations", auth, async (req, res, next) => {
    try {
      const access = await authorizedWrite(req, res, "labs");
      if (!access) return;
      const title = requiredText(req.body, "title", 200);
      const value = requiredText(req.body, "value", 200);
      const unitValue = req.body?.unit;
      const unit = typeof unitValue === "string" && unitValue.length <= 80 ? unitValue.trim() : null;
      const observedAt = toDate(req.body?.date);
      if (!title || !value || unit === null || !observedAt) return responseError(res, 400, "INVALID_OBSERVATION", "A valid observation, value, unit, and date are required.");
      const record = await models.Observation.create({
        patientId: access.patient._id,
        clinicianId: access.clinician._id,
        organizationId: access.user.organizationId,
        code: "CLINICIAN_REPORTED",
        display: title,
        value,
        unit,
        observedAt,
      });
      await writeAudit(req, access.user, "CLINICAL_OBSERVATION_CREATED", "Patient", access.patient._id.toString());
      return res.status(201).json({ id: record._id.toString(), title, value, unit, date: observedAt.toISOString().slice(0, 10), clinicianName: access.clinician.displayName });
    } catch (error) {
      next(error);
    }
  });

  return router;
}