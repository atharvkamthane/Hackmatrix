import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import mongoose, { type Connection } from "mongoose";
import {
  createClinicalModels,
  clinicalScopes,
} from "./clinical";
import {
  cleanupSeededRecords,
  SEED_ORGANIZATION_CLERK_IDS,
  SEED_USER_CLERK_IDS,
} from "./seed-cleanup";

const connection = mongoose.createConnection();
(connection as unknown as { plane: string }).plane = "clinical";
const models = createClinicalModels(connection);
const organizationId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const patientId = new mongoose.Types.ObjectId();
const clinicianId = new mongoose.Types.ObjectId();

test.after(async () => {
  await connection.close();
});

test("valid patient and clinician preserve organization identity relationships", () => {
  const patient = new models.Patient({
    userId,
    organizationId,
    displayName: "Synthetic Patient One",
    dateOfBirth: new Date("1990-01-01"),
  });
  const clinician = new models.Clinician({
    userId: new mongoose.Types.ObjectId(),
    organizationId,
    displayName: "Synthetic Clinician One",
    professionalId: "SYN-CLIN-001",
  });

  assert.equal(patient.validateSync(), undefined);
  assert.equal(clinician.validateSync(), undefined);
  assert.equal(String(patient.organizationId), String(clinician.organizationId));
});

test("access requests and grants require explicit scopes", () => {
  const accessRequest = new models.AccessRequest({
    patientId,
    clinicianId,
    organizationId,
    requestedScopes: ["visits", "labs"],
    expiresAt: new Date("2030-01-01"),
  });
  const grant = new models.AccessGrant({
    patientId,
    clinicianId,
    organizationId,
    scopes: ["prescriptions"],
    expiresAt: new Date("2030-01-01"),
  });

  assert.equal(accessRequest.validateSync(), undefined);
  assert.equal(grant.validateSync(), undefined);
  assert.equal(accessRequest.requestedDurationMinutes, 60);
  assert.deepEqual(clinicalScopes, ["visits", "prescriptions", "labs"]);
});

test("access requests enforce permitted durations of 15, 30, and 60 minutes", () => {
  for (const duration of [15, 30, 60]) {
    const validRequest = new models.AccessRequest({
      patientId,
      clinicianId,
      organizationId,
      requestedScopes: ["visits"],
      requestedDurationMinutes: duration,
      expiresAt: new Date("2030-01-01"),
    });
    assert.equal(validRequest.validateSync(), undefined);
  }

  const invalidRequest = new models.AccessRequest({
    patientId,
    clinicianId,
    organizationId,
    requestedScopes: ["visits"],
    requestedDurationMinutes: 45,
    expiresAt: new Date("2030-01-01"),
  });
  assert.notEqual(invalidRequest.validateSync(), undefined);
});

test("expired and revoked grants are representable without changing patient identity", () => {
  const grant = new models.AccessGrant({
    patientId,
    clinicianId,
    organizationId,
    scopes: ["visits"],
    status: "REVOKED",
    issuedAt: new Date("2020-01-01"),
    expiresAt: new Date("2020-01-02"),
    revokedAt: new Date("2020-01-01T12:00:00Z"),
  });

  assert.equal(grant.validateSync(), undefined);
  assert.equal(grant.status, "REVOKED");
  assert.equal(String(grant.patientId), String(patientId));
});

test("QR tokens store hashes and enforce unique hash lookup indexes", () => {
  const token = new models.QRToken({
    tokenHash: "a".repeat(64),
    patientId,
    expiresAt: new Date("2030-01-01"),
    createdByUserId: userId,
  });

  assert.equal(token.validateSync(), undefined);
  assert.equal(token.tokenHash.length, 64);
  assert.ok(models.QRToken.schema.indexes().some(([fields, options]: any[]) =>
    fields.tokenHash === 1 && fields.expiresAt === 1 && options?.unique === true,
  ));
});

test("audit logs contain metadata only and index by timestamp", () => {
  const audit = new models.AuditLog({
    actorUserId: "user_synthetic",
    actorRole: "CLINICIAN",
    organizationId,
    action: "ACCESS_REQUEST_CREATED",
    resourceType: "AccessRequest",
    resourceReference: "request_synthetic",
    result: "SUCCESS",
    correlationId: "request-correlation-synthetic",
  });

  assert.equal(audit.validateSync(), undefined);
  assert.equal("clinicalPayload" in audit.toObject(), false);
  assert.ok(models.AuditLog.schema.indexes().some(([fields]: any[]) => fields.occurredAt === -1));
});

test("cannot register clinical models on an analytics connection plane", async () => {
  const analyticsConn = mongoose.createConnection();
  (analyticsConn as unknown as { plane: string }).plane = "analytics";
  try {
    assert.throws(
      () => createClinicalModels(analyticsConn),
      /Cannot register clinical models on analytics connection\. Clinical models are restricted to the clinical data plane\./,
    );
  } finally {
    await analyticsConn.close();
  }
});

test("cannot register clinical models on a connection with analytics in dbName", async () => {
  const analyticsConn = mongoose.createConnection();
  Object.defineProperty(analyticsConn, "name", { value: "hackmatrix_analytics" });
  try {
    assert.throws(
      () => createClinicalModels(analyticsConn),
      /Cannot register clinical models on analytics connection\. Clinical models are restricted to the clinical data plane\./,
    );
  } finally {
    await analyticsConn.close();
  }
});

test("admin analytics route module does not import clinical models", () => {
  const adminRoutePath = path.resolve(process.cwd(), "src/routes/admin-analytics.ts");
  const adminContent = fs.readFileSync(adminRoutePath, "utf8");
  assert.equal(
    adminContent.includes("models/clinical"),
    false,
    "admin-analytics.ts must not import clinical models directly",
  );
});

test("seed cleanup targets only seed-owned records and preserves unrelated records", async () => {
  const deleteCalls: Record<string, any[]> = {};
  const mockModels: any = {
    Organization: {
      find: (filter: any) => ({
        select: async () => [{ _id: "seed_org_1" }],
      }),
      deleteMany: async (filter: any) => { deleteCalls.Organization = filter; },
    },
    User: {
      find: (filter: any) => ({
        select: async () => [{ _id: "seed_user_1" }],
      }),
      deleteMany: async (filter: any) => { deleteCalls.User = filter; },
    },
    Patient: {
      find: (filter: any) => ({
        select: async () => [{ _id: "seed_patient_1" }],
      }),
      deleteMany: async (filter: any) => { deleteCalls.Patient = filter; },
    },
    Clinician: {
      find: (filter: any) => ({
        select: async () => [{ _id: "seed_clinician_1" }],
      }),
      deleteMany: async (filter: any) => { deleteCalls.Clinician = filter; },
    },
    Encounter: {
      deleteMany: async (filter: any) => { deleteCalls.Encounter = filter; },
    },
    Condition: {
      deleteMany: async (filter: any) => { deleteCalls.Condition = filter; },
    },
    MedicationRequest: {
      deleteMany: async (filter: any) => { deleteCalls.MedicationRequest = filter; },
    },
    Observation: {
      deleteMany: async (filter: any) => { deleteCalls.Observation = filter; },
    },
    AuditLog: {
      deleteMany: async (filter: any) => { deleteCalls.AuditLog = filter; },
    },
  };

  await cleanupSeededRecords(mockModels);

  // Assert cleanup used specific IDs rather than broad regex like /^Synthetic/
  assert.deepEqual(deleteCalls.Patient, { _id: { $in: ["seed_patient_1"] } });
  assert.deepEqual(deleteCalls.Clinician, { _id: { $in: ["seed_clinician_1"] } });
  assert.deepEqual(deleteCalls.Encounter, { patientId: { $in: ["seed_patient_1"] } });
  assert.deepEqual(deleteCalls.Condition, { patientId: { $in: ["seed_patient_1"] } });
  assert.deepEqual(deleteCalls.MedicationRequest, { patientId: { $in: ["seed_patient_1"] } });
  assert.deepEqual(deleteCalls.Observation, { patientId: { $in: ["seed_patient_1"] } });
  assert.deepEqual(deleteCalls.AuditLog, { actorUserId: { $in: [...SEED_USER_CLERK_IDS] } });
});

