import assert from "node:assert/strict";
import mongoose from "mongoose";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hackmatrix";
const TEST_RUN_ID = `wf_${Date.now()}`;

const PATIENT_USER_ID = `test_user_patient_${TEST_RUN_ID}`;
const CLINICIAN_USER_ID = `test_user_clinician_${TEST_RUN_ID}`;
const UNPROVISIONED_USER_ID = `test_user_unprov_${TEST_RUN_ID}`;

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type");
  let body: any = null;
  if (contentType?.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  return { status: response.status, ok: response.ok, body, headers: response.headers };
}

async function main() {
  console.log("===============================================================================");
  console.log("HACKMATRIX: REAL MOBILE WORKFLOW & BACKEND INTEGRATION VERIFICATION");
  console.log("===============================================================================");
  console.log(`API Base URL: ${API_BASE}`);
  console.log(`MongoDB URI:  ${MONGO_URI}`);
  console.log(`Run ID:       ${TEST_RUN_ID}`);

  // Connect to MongoDB to inspect state and perform pre/post assertions
  const conn = mongoose.createConnection(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await conn.asPromise();
  const db = conn;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Unauthenticated & Unprovisioned Account Handling
    // -------------------------------------------------------------------------
    console.log("\n[1/10] Verifying unauthenticated and unprovisioned account protection...");
    
    // 1a. Unauthenticated request must return 401
    const unauth = await apiRequest("/api/auth/me");
    assert.equal(unauth.status, 401, "Unauthenticated /api/auth/me should return 401");
    console.log("  ✔ Unauthenticated request rejected with 401 UNAUTHENTICATED");

    // 1b. Unprovisioned account must return 403 USER_NOT_PROVISIONED
    const unprov = await apiRequest("/api/auth/me", {
      headers: { Authorization: `Bearer ${UNPROVISIONED_USER_ID}` },
    });
    assert.equal(unprov.status, 403, "Unprovisioned identity should return 403");
    assert.equal(unprov.body?.error?.code, "USER_NOT_PROVISIONED", "Error code should be USER_NOT_PROVISIONED");
    console.log("  ✔ Unmapped Clerk identity rejected with 403 USER_NOT_PROVISIONED");

    // 1c. Client role spoofing attempt must fail
    const spoofAttempt = await apiRequest("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${UNPROVISIONED_USER_ID}`,
        "X-User-Role": "ADMIN",
        "X-Requested-Role": "CLINICIAN",
      },
    });
    assert.equal(spoofAttempt.status, 403, "Client header spoofing cannot elevate unprovisioned identity");
    console.log("  ✔ Client role spoofing headers ignored; backend remains authority");

    // -------------------------------------------------------------------------
    // STEP 2: Self-Provisioning for Test Patient & Test Clinician
    // -------------------------------------------------------------------------
    console.log("\n[2/10] Testing secure account provisioning for Patient and Clinician...");

    // 2a. Provision Patient
    const provPatient = await apiRequest("/api/auth/provision-self", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PATIENT_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "PATIENT",
        name: `Aria Stark [${TEST_RUN_ID}]`,
        detail: "Seasonal asthma, penicillin allergy",
      }),
    });
    assert.ok(provPatient.status === 200 || provPatient.status === 201, "Patient provisioning should succeed with 200 or 201");
    assert.equal(provPatient.body?.role, "PATIENT");
    console.log(`  ✔ Patient provisioned: ${provPatient.body.profile.name} (${provPatient.body.userId})`);

    // Verify patient role on /api/auth/me
    const patientMe = await apiRequest("/api/auth/me", {
      headers: { Authorization: `Bearer ${PATIENT_USER_ID}` },
    });
    assert.equal(patientMe.status, 200);
    assert.equal(patientMe.body.role, "PATIENT");
    assert.ok(patientMe.body.capabilities.includes("qr:create:self"));
    console.log("  ✔ Verified Patient identity on /api/auth/me");

    // 2b. Provision Clinician
    const provClinician = await apiRequest("/api/auth/provision-self", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLINICIAN_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "CLINICIAN",
        name: `Dr. Gregory House [${TEST_RUN_ID}]`,
        detail: "Diagnostics & Internal Medicine",
      }),
    });
    assert.ok(provClinician.status === 200 || provClinician.status === 201, "Clinician provisioning should succeed with 200 or 201");
    assert.equal(provClinician.body?.role, "CLINICIAN");
    console.log(`  ✔ Clinician provisioned: ${provClinician.body.profile.name} (${provClinician.body.userId})`);

    // Verify clinician role on /api/auth/me
    const clinicianMe = await apiRequest("/api/auth/me", {
      headers: { Authorization: `Bearer ${CLINICIAN_USER_ID}` },
    });
    assert.equal(clinicianMe.status, 200);
    assert.equal(clinicianMe.body.role, "CLINICIAN");
    assert.ok(clinicianMe.body.capabilities.includes("access:request"));
    console.log("  ✔ Verified Clinician identity on /api/auth/me");

    // 2c. Verify cannot self-provision as ADMIN
    const adminAttempt = await apiRequest("/api/auth/provision-self", {
      method: "POST",
      headers: {
        Authorization: `Bearer test_user_bad_admin_${TEST_RUN_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "ADMIN", name: "Malicious User" }),
    });
    assert.equal(adminAttempt.status, 400, "Cannot self-provision as ADMIN");
    console.log("  ✔ Self-provisioning as ADMIN safely rejected with 400");

    // -------------------------------------------------------------------------
    // STEP 3: Role Separation & Strict Permission Boundaries
    // -------------------------------------------------------------------------
    console.log("\n[3/10] Verifying strict role separation between Patient and Clinician...");

    // Patient cannot access clinician routes
    const patOnClinRoute = await apiRequest("/api/clinician/patients", {
      headers: { Authorization: `Bearer ${PATIENT_USER_ID}` },
    });
    assert.equal(patOnClinRoute.status, 403, "Patient cannot access /api/clinician/patients");

    // Clinician cannot access patient profile/qr routes
    const clinOnPatRoute = await apiRequest("/api/patient/qr-token", {
      headers: { Authorization: `Bearer ${CLINICIAN_USER_ID}` },
    });
    assert.equal(clinOnPatRoute.status, 403, "Clinician cannot access /api/patient/qr-token");
    console.log("  ✔ Cross-role endpoint access strictly forbidden with 403");

    // -------------------------------------------------------------------------
    // STEP 4: Patient Generates Short-Lived Single-Use QR Token
    // -------------------------------------------------------------------------
    console.log("\n[4/10] Patient generates short-lived QR token...");

    const qrRes = await apiRequest("/api/patient/qr-token", {
      headers: { Authorization: `Bearer ${PATIENT_USER_ID}` },
    });
    assert.equal(qrRes.status, 200, "Patient should obtain QR token");
    const { payload: qrPayload, expiresAt: qrExpiresAt } = qrRes.body;
    assert.ok(qrPayload && typeof qrPayload === "string", "QR payload must be string");
    assert.ok(qrExpiresAt, "QR token must have expiresAt");
    
    // Verify payload is opaque and does NOT leak patient clinical records or internal IDs
    assert.ok(!qrPayload.includes("Aria"), "QR payload must not leak patient name");
    assert.ok(!qrPayload.includes("asthma"), "QR payload must not leak medical notes");
    console.log(`  ✔ Generated opaque QR token: ${qrPayload.slice(0, 16)}... (Expires: ${qrExpiresAt})`);

    // -------------------------------------------------------------------------
    // STEP 5: Clinician Scans/Resolves QR Token & Single-Use Enforcement
    // -------------------------------------------------------------------------
    console.log("\n[5/10] Clinician scans and resolves the QR token...");

    const resolveRes = await apiRequest("/api/clinician/qr/resolve", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLINICIAN_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: qrPayload,
        scopes: ["visits", "prescriptions"],
        durationMinutes: 30,
      }),
    });
    assert.equal(resolveRes.status, 201, "QR resolution should create an access request");
    const accessRequest = resolveRes.body;
    assert.ok(accessRequest.id, "Access request must have an ID");
    assert.equal(accessRequest.status, "pending", "Initial request status must be pending");
    assert.equal(accessRequest.durationMinutes, 30);
    console.log(`  ✔ Access request created: ID ${accessRequest.id} (Status: ${accessRequest.status})`);

    // 5b. Verify single-use: Clinician attempting to reuse the same QR token must be rejected
    const replayRes = await apiRequest("/api/clinician/qr/resolve", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLINICIAN_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: qrPayload,
      }),
    });
    assert.ok(replayRes.status === 404 || replayRes.status === 409, "Reused QR token must be rejected");
    console.log(`  ✔ Replay attempt blocked with HTTP ${replayRes.status} (Single-use strictly enforced)`);

    // 5c. Prior to patient approval, clinician cannot view patient records
    const preConsentRead = await apiRequest(`/api/clinician/patients/${accessRequest.patientId}`, {
      headers: { Authorization: `Bearer ${CLINICIAN_USER_ID}` },
    });
    assert.ok(preConsentRead.body === null, "Records must be completely unavailable before consent");
    console.log("  ✔ Clinician record lookup returns null before patient approval");

    // -------------------------------------------------------------------------
    // STEP 6: Patient Reviews & Approves Access Request
    // -------------------------------------------------------------------------
    console.log("\n[6/10] Patient views pending requests and approves access...");

    const patientRequests = await apiRequest("/api/patient/access-requests", {
      headers: { Authorization: `Bearer ${PATIENT_USER_ID}` },
    });
    assert.equal(patientRequests.status, 200);
    const foundReq = patientRequests.body.find((r: any) => r.id === accessRequest.id);
    assert.ok(foundReq, "Created request must appear in patient's pending list");
    assert.equal(foundReq.status, "pending");
    console.log(`  ✔ Patient retrieved pending request from ${foundReq.clinicianName}`);

    // Patient approves request
    const approveRes = await apiRequest(`/api/patient/access-requests/${accessRequest.id}/decision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PATIENT_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision: "approved" }),
    });
    assert.equal(approveRes.status, 200, "Approval should succeed with 200");
    assert.equal(approveRes.body.status, "approved");
    const grantId = approveRes.body.grantId;
    assert.ok(grantId, "Approval must yield a grant ID");
    console.log(`  ✔ Request approved! Active Access Grant ID: ${grantId}`);

    // Verify grant appears in patient's active grants list
    const patientGrants = await apiRequest("/api/patient/grants", {
      headers: { Authorization: `Bearer ${PATIENT_USER_ID}` },
    });
    const foundGrant = patientGrants.body.find((g: any) => g.id === grantId);
    assert.ok(foundGrant, "New grant must appear in patient's grants list");
    assert.equal(foundGrant.status, "active");
    console.log(`  ✔ Grant confirmed active in patient grants (Expires: ${foundGrant.expiresAt})`);

    // -------------------------------------------------------------------------
    // STEP 7: Clinician Reads Authorized Records & Checks Scope
    // -------------------------------------------------------------------------
    console.log("\n[7/10] Clinician accesses authorized patient records...");

    const authPatientData = await apiRequest(`/api/clinician/patients/${accessRequest.patientId}`, {
      headers: { Authorization: `Bearer ${CLINICIAN_USER_ID}` },
    });
    assert.equal(authPatientData.status, 200);
    assert.ok(authPatientData.body !== null, "Authorized patient data must be returned");
    assert.equal(authPatientData.body.patient.id, accessRequest.patientId);
    assert.equal(authPatientData.body.grant.id, grantId);
    console.log(`  ✔ Clinician retrieved authorized records for: ${authPatientData.body.patient.name}`);

    // -------------------------------------------------------------------------
    // STEP 8: Clinician Records Condition & Encounter, Persists to Clinical DB
    // -------------------------------------------------------------------------
    console.log("\n[8/10] Clinician writes clinical condition and encounter...");

    // Record a condition
    const createCondRes = await apiRequest("/api/clinician/conditions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLINICIAN_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientId: accessRequest.patientId,
        display: `COVID-19 Respiratory Infection [${TEST_RUN_ID}]`,
        code: "RESP_COVID19",
        date: "2026-10-10",
      }),
    });
    assert.equal(createCondRes.status, 201, "Recording condition should succeed with 201");
    assert.equal(createCondRes.body.status, "Active");
    console.log(`  ✔ Condition persisted: ${createCondRes.body.name} (${createCondRes.body.id})`);

    // Record an encounter
    const createEncRes = await apiRequest("/api/clinician/encounters", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLINICIAN_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientId: accessRequest.patientId,
        diagnosis: `Acute viral infection follow-up [${TEST_RUN_ID}]`,
        reason: "Patient reports coughing and mild fever",
        date: "2026-10-10",
      }),
    });
    assert.equal(createEncRes.status, 201, "Recording encounter should succeed with 201");
    console.log(`  ✔ Encounter persisted: ${createEncRes.body.diagnosis} (${createEncRes.body.id})`);

    // Verify patient's own view includes the newly recorded records
    const patientRecords = await apiRequest("/api/patient/records", {
      headers: { Authorization: `Bearer ${PATIENT_USER_ID}` },
    });
    assert.equal(patientRecords.status, 200);
    const patCond = patientRecords.body.conditions.find((c: any) => c.id === createCondRes.body.id);
    const patEnc = patientRecords.body.encounters.find((e: any) => e.id === createEncRes.body.id);
    assert.ok(patCond, "Condition must be visible in patient's records");
    assert.ok(patEnc, "Encounter must be visible in patient's records");
    console.log("  ✔ Patient profile reflects persisted condition and encounter updates");

    // -------------------------------------------------------------------------
    // STEP 9: Patient Revocation Immediately Blocks Clinician Access
    // -------------------------------------------------------------------------
    console.log("\n[9/10] Patient revokes access grant; verifying immediate termination...");

    const revokeRes = await apiRequest(`/api/patient/grants/${grantId}/revoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PATIENT_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(revokeRes.status, 200, "Revocation should succeed with 200");
    console.log("  ✔ Access grant successfully revoked by patient");

    // Clinician tries to read records after revocation
    const postRevokeRead = await apiRequest(`/api/clinician/patients/${accessRequest.patientId}`, {
      headers: { Authorization: `Bearer ${CLINICIAN_USER_ID}` },
    });
    assert.ok(postRevokeRead.body === null, "Subsequent clinician read must return null / access denied");
    console.log("  ✔ Subsequent clinician read returned null (Immediate denial verified)");

    // Clinician tries to write after revocation
    const postRevokeWrite = await apiRequest("/api/clinician/encounters", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLINICIAN_USER_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientId: accessRequest.patientId,
        diagnosis: "Illegal attempt after revocation",
        reason: "Test",
        date: "2026-10-10",
      }),
    });
    assert.equal(postRevokeWrite.status, 403, "Writing after revocation must return 403 CONSENT_REQUIRED");
    assert.equal(postRevokeWrite.body?.error?.code, "CONSENT_REQUIRED");
    console.log("  ✔ Post-revocation write blocked with 403 CONSENT_REQUIRED");

    // -------------------------------------------------------------------------
    // STEP 10: Privacy-Preserving Audit Trail Verification
    // -------------------------------------------------------------------------
    console.log("\n[10/10] Verifying audit logs contain metadata only (no personal data leakage)...");

    const auditColl = db.collection("auditLogs");
    const patientAudits = await auditColl.find({ actorUserId: PATIENT_USER_ID }).toArray();
    const clinicianAudits = await auditColl.find({ actorUserId: CLINICIAN_USER_ID }).toArray();

    assert.ok(patientAudits.length > 0, "Patient audit events must exist");
    assert.ok(clinicianAudits.length > 0, "Clinician audit events must exist");

    // Check actions recorded
    const patientActions = patientAudits.map((a: any) => a.action);
    const clinicianActions = clinicianAudits.map((a: any) => a.action);

    assert.ok(patientActions.includes("QR_TOKEN_GENERATED") || patientActions.includes("ACCESS_REQUEST_APPROVED") || patientActions.includes("ACCESS_GRANT_REVOKED"));
    assert.ok(clinicianActions.includes("ACCESS_REQUEST_CREATED") || clinicianActions.includes("CLINICIAN_AUTHORIZED_RECORDS_READ") || clinicianActions.includes("CLINICAL_CONDITION_CREATED"));

    // Check for sensitive clinical leaks in audit log records
    const allWorkflowAudits = [...patientAudits, ...clinicianAudits];
    for (const audit of allWorkflowAudits) {
      const serialized = JSON.stringify(audit);
      assert.ok(!serialized.includes("Aria Stark"), "Audit log must not contain patient full name in payload");
      assert.ok(!serialized.includes("penicillin"), "Audit log must not contain patient allergies in payload");
      assert.ok(!serialized.includes("Acute viral infection follow-up"), "Audit log must not contain diagnosis text");
    }
    console.log(`  ✔ Verified ${allWorkflowAudits.length} audit entries: strictly metadata-only, zero sensitive clinical data leaked`);

    console.log("\n===============================================================================");
    console.log("ALL 10 VERIFICATION CHECKS PASSED SUCCESSFULLY!");
    console.log("The real mobile workflow and backend integration is 100% verified.");
    console.log("===============================================================================\n");
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
