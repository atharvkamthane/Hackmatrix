import assert from "node:assert/strict";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hackmatrix";
const TEST_TAG = "CONTROLLED_VERIFICATION_TEST";

async function main() {
  console.log("===============================================================================");
  console.log("HACKMATRIX: CONTROLLED CLINICAL-TO-ANALYTICS ETL VERIFICATION");
  console.log("===============================================================================");
  console.log(`Connecting to database: ${MONGO_URI}`);

  const conn = mongoose.createConnection(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await conn.asPromise();

  const orgsColl = conn.collection("organizations");
  const condsColl = conn.collection("conditions");
  const ledgerColl = conn.collection("etlLedgers");
  const aggsColl = conn.collection("surveillanceAggregates");
  const checkColl = conn.collection("etlCheckpoints");

  // 0. CLEANUP ANY STALE TEST ARTIFACTS BEFORE BASELINE
  console.log("\n[0/8] Pre-cleaning any stale test records from previous runs...");
  const staleDeleted = await condsColl.deleteMany({ display: { $regex: TEST_TAG } });
  await orgsColl.deleteMany({ name: { $regex: TEST_TAG } });
  if (staleDeleted.deletedCount > 0) {
    console.log(`  Removed ${staleDeleted.deletedCount} stale test conditions. Waiting 3s for ETL to reconcile...`);
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }

  // 1. RECORD BASELINE
  console.log("\n[1/8] Recording baseline analytics aggregate...");
  const baselineLedger = await ledgerColl.countDocuments({ status: "ACTIVE" });
  const baselineAgg = await aggsColl.findOne({ period: "2026-10", category: "VectorBorne", regionId: "reg_mh" });
  const baselineCount = baselineAgg ? baselineAgg.caseCount : 0;
  console.log(`  Baseline active ledger records: ${baselineLedger}`);
  console.log(`  Baseline VectorBorne case count in reg_mh: ${baselineCount}`);

  // Fetch API baseline
  const apiBaselineRes = await fetch("http://localhost:5000/api/admin/summary", {
    headers: { Authorization: "Bearer dev_admin_token" },
  });
  assert.equal(apiBaselineRes.status, 200, "API /admin/summary should respond with 200");
  const apiBaseline = await apiBaselineRes.json();
  console.log(`  Baseline API total cases:`, JSON.stringify(apiBaseline.kpi.totalReportedCases));
  console.log(`  Baseline isDemoData flag: ${apiBaseline.kpi.isDemoData}`);
  assert.equal(apiBaseline.kpi.isDemoData, false, "Live API should report isDemoData = false");

  // 2. CREATE ELIGIBLE SYNTHETIC CONDITION RECORDS
  console.log("\n[2/8] Creating eligible synthetic Condition records (N=12 distinct patients + 1 deduplication check)...");
  const orgResult = await orgsColl.insertOne({
    name: `Surveillance Center [${TEST_TAG}]`,
    regionId: "reg_mh",
    stateName: "Maharashtra",
    districtName: "Pune District",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const orgId = orgResult.insertedId;

  const clinicianId = new mongoose.Types.ObjectId();
  const testConditions = [];
  const testPatientIds = [];

  for (let i = 1; i <= 12; i++) {
    const patientId = new mongoose.Types.ObjectId();
    testPatientIds.push(patientId);
    testConditions.push({
      patientId,
      organizationId: orgId,
      recordedByClinicianId: clinicianId,
      code: "VEC_DENGUE",
      display: `Dengue Virus [${TEST_TAG} #${i}]`,
      clinicalStatus: "active",
      onsetDate: new Date("2026-10-05T10:00:00Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Insert a duplicate condition for patient #1 (to test counting rule: distinct patient per bucket)
  testConditions.push({
    patientId: testPatientIds[0],
    organizationId: orgId,
    recordedByClinicianId: clinicianId,
    code: "VEC_CHIKUNGUNYA",
    display: `Chikungunya Virus [${TEST_TAG} Dup]`,
    clinicalStatus: "active",
    onsetDate: new Date("2026-10-06T10:00:00Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const insertResult = await condsColl.insertMany(testConditions);
  console.log(`  Inserted ${insertResult.insertedCount} Condition documents into clinical collection for 12 distinct patients.`);

  // 3. WAIT FOR POLLING / STREAM PROCESSING
  console.log("\n[3/8] Waiting for ETL ingestion (polling interval ~2-4s)...");
  let ingested = false;
  let targetAgg: any = null;
  const expectedCount = baselineCount + 12;

  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    targetAgg = await aggsColl.findOne({ period: "2026-10", category: "VectorBorne", regionId: "reg_mh" });
    if (targetAgg && targetAgg.caseCount === expectedCount) {
      ingested = true;
      console.log(`  Ingestion verified on attempt ${attempt}! Case count reached ${expectedCount}.`);
      break;
    }
  }
  assert.ok(ingested, `ETL engine should process conditions and update aggregate to ${expectedCount} within 15 seconds.`);

  // 4. VERIFY ETL STATUS & CHECKPOINT ADVANCES
  console.log("\n[4/8] Verifying ETL status and checkpoint advancement...");
  const checkpoint = await checkColl.findOne({ streamName: "conditions" });
  assert.ok(checkpoint, "Checkpoint document should exist");
  console.log(`  Checkpoint eventsProcessed: ${checkpoint.eventsProcessed}`);
  console.log(`  Checkpoint status: ${checkpoint.status}, mode: ${checkpoint.mode}`);
  assert.ok(checkpoint.eventsProcessed >= 13, "Events processed should have advanced by at least 13");

  const statusRes = await fetch("http://localhost:5000/api/admin/etl-status", {
    headers: { Authorization: "Bearer dev_admin_token" },
  });
  const statusJson = await statusRes.json();
  console.log(`  Live /api/admin/etl-status:`, JSON.stringify(statusJson));
  assert.equal(statusJson.status, "RUNNING");

  // 5. VERIFY ANALYTICS AGGREGATE COLLECTION & DEDUPLICATION
  console.log("\n[5/8] Verifying analytics collection data contract & counting rule...");
  console.log(`  Surveillance Aggregate document:`, JSON.stringify(targetAgg, null, 2));
  assert.equal(targetAgg.period, "2026-10");
  assert.equal(targetAgg.category, "VectorBorne");
  assert.equal(targetAgg.regionId, "reg_mh");
  assert.equal(targetAgg.stateName, "Maharashtra");
  // Verification of counting rule: 13 conditions inserted, but only 12 distinct patients!
  assert.equal(targetAgg.caseCount, expectedCount, `Aggregate case count must equal ${expectedCount} (distinct patients only)`);
  assert.equal(targetAgg.isSynthetic, false);
  // Privacy check: Verify zero PII on aggregate
  assert.equal((targetAgg as any).patientId, undefined);
  assert.equal((targetAgg as any).patientName, undefined);

  // 6. VERIFY ADMIN API REFLECTS THE CHANGED AGGREGATE
  console.log("\n[6/8] Verifying live Admin API endpoint returns new aggregate...");
  const apiSummaryRes = await fetch("http://localhost:5000/api/admin/summary", {
    headers: { Authorization: "Bearer dev_admin_token" },
  });
  const apiSummary = await apiSummaryRes.json();
  console.log(`  Total reported cases KPI:`, JSON.stringify(apiSummary.kpi.totalReportedCases));
  // Since count is >= 12 (>= K=10), it MUST NOT be suppressed!
  assert.equal(apiSummary.kpi.totalReportedCases.suppressed, false, "K=10 threshold passed, so count should not be suppressed");
  assert.equal(apiSummary.kpi.totalReportedCases.count, expectedCount);
  assert.equal(apiSummary.kpi.isDemoData, false);

  const octTrend = apiSummary.monthlyTrends.find((t: any) => t.month === "2026-10");
  assert.ok(octTrend, "October 2026 trend should be present");
  console.log(`  October 2026 VectorBorne trend:`, JSON.stringify(octTrend.VectorBorne));
  assert.deepEqual(octTrend.VectorBorne, { suppressed: false, count: expectedCount });

  // 7. TEST UPDATE: RESOLVED/INACTIVE DECREMENTS COUNT
  console.log("\n[7/8] Testing update: marking 4 conditions as resolved/inactive...");
  const testIds = insertResult.insertedIds;
  // Pick conditions from patients 8, 9, 10, 11 (distinct patients)
  const toDeactivate = [testIds[8], testIds[9], testIds[10], testIds[11]];
  await condsColl.updateMany(
    { _id: { $in: toDeactivate } },
    { $set: { clinicalStatus: "resolved", updatedAt: new Date() } },
  );
  console.log(`  Marked 4 conditions as resolved. Waiting for ETL recomputation...`);

  const expectedUpdatedCount = baselineCount + 8;
  let updated = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    targetAgg = await aggsColl.findOne({ period: "2026-10", category: "VectorBorne", regionId: "reg_mh" });
    if (targetAgg && targetAgg.caseCount === expectedUpdatedCount) {
      updated = true;
      console.log(`  Recomputation verified: case count decreased from ${expectedCount} to ${expectedUpdatedCount}!`);
      break;
    }
  }
  assert.ok(updated, `Aggregate should decrease to ${expectedUpdatedCount} active cases.`);

  // 8. TEST DELETE: HARD DELETION RECONCILIATION & CLEANUP
  console.log("\n[8/8] Testing hard deletion reconciliation & cleaning up test records...");
  await condsColl.deleteMany({ display: { $regex: TEST_TAG } });
  await orgsColl.deleteOne({ _id: orgId });
  console.log(`  Deleted all controlled test clinical records. Waiting for ETL polling reconciliation...`);

  let cleaned = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    targetAgg = await aggsColl.findOne({ period: "2026-10", category: "VectorBorne", regionId: "reg_mh" });
    if (!targetAgg || targetAgg.caseCount === baselineCount) {
      cleaned = true;
      console.log(`  Deletions reconciled cleanly by ETL! Final bucket case count returned to baseline: ${baselineCount}.`);
      break;
    }
  }
  assert.ok(cleaned, `Aggregate should return to baseline count ${baselineCount} after test record deletion.`);

  // Verify final API call confirms clean baseline and isDemoData = false
  const finalApiRes = await fetch("http://localhost:5000/api/admin/summary", {
    headers: { Authorization: "Bearer dev_admin_token" },
  });
  const finalApi = await finalApiRes.json();
  if (finalApiRes.status !== 200) {
    console.error("  Final API error response:", finalApiRes.status, finalApi);
  }
  assert.equal(finalApiRes.status, 200);
  assert.equal(finalApi.kpi.isDemoData, false, "Live API isDemoData must remain false");

  await conn.close();
  console.log("\n===============================================================================");
  console.log("ALL 8 CONTROLLED ETL VERIFICATION PHASES PASSED WITH ZERO ERRORS!");
  console.log("===============================================================================\n");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
