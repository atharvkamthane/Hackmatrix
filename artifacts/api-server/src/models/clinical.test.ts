import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
  createClinicalModels,
  clinicalScopes,
} from "./clinical";

const connection = mongoose.createConnection();
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
  assert.deepEqual(clinicalScopes, ["visits", "prescriptions", "labs"]);
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
  assert.ok(models.QRToken.schema.indexes().some(([fields, options]) =>
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
  assert.ok(models.AuditLog.schema.indexes().some(([fields]) => fields.occurredAt === -1));
});
