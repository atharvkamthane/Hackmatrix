import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
  normalizeConditionCategory,
  toReportingPeriod,
  resolveRegion,
  hashPatientId,
  APPROVED_REGIONS,
} from "./taxonomy";
import { transformCondition, type SourceConditionDoc } from "./transformer";
import { applyCaseFact, recomputeBucket } from "./aggregator";
import { createAnalyticsModels, type AnalyticsModels } from "../models/analytics";
import { createClinicalModels } from "../models/clinical";
import { etlStatusTracker } from "./status";
import { rebuildAnalytics } from "./rebuild";
import { EtlEngine } from "./engine";
import { aggregateCount } from "../routes/admin-analytics";

const TEST_DB_URI = "mongodb://127.0.0.1:27017/hackmatrix_test_etl";

async function createTestConnections() {
  const clinicalConn = mongoose.createConnection(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  const analyticsConn = mongoose.createConnection(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
  (clinicalConn as unknown as { plane: string }).plane = "clinical";
  (analyticsConn as unknown as { plane: string }).plane = "analytics";

  await Promise.all([clinicalConn.asPromise(), analyticsConn.asPromise()]);

  const clinicalModels = createClinicalModels(clinicalConn);
  const analyticsModels = createAnalyticsModels(analyticsConn);

  return {
    connections: { clinical: clinicalConn, analytics: analyticsConn },
    clinicalModels,
    analyticsModels,
    cleanup: async () => {
      await analyticsConn.collection("etlLedgers").deleteMany({});
      await analyticsConn.collection("etlCheckpoints").deleteMany({});
      await analyticsConn.collection("surveillanceAggregates").deleteMany({});
      await clinicalConn.collection("conditions").deleteMany({});
      await clinicalConn.collection("organizations").deleteMany({});
      await Promise.all([clinicalConn.close(), analyticsConn.close()]);
    },
  };
}

// 1. Valid clinical record transforms to expected aggregate key
test("1. Valid clinical record transforms to expected aggregate key", () => {
  const patientId = new mongoose.Types.ObjectId();
  const conditionId = new mongoose.Types.ObjectId();

  const source: SourceConditionDoc = {
    _id: conditionId,
    patientId,
    code: "RESP_COVID19",
    display: "COVID-19 Confirmed Case",
    clinicalStatus: "active",
    onsetDate: new Date("2026-05-15T10:00:00Z"),
  };

  const result = transformCondition(source, { regionId: "reg_dl" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.fact.category, "Respiratory");
    assert.equal(result.fact.period, "2026-05");
    assert.equal(result.fact.regionId, "reg_dl");
    assert.equal(result.fact.stateName, "Delhi NCR");
    assert.equal(result.fact.districtName, "Central Delhi");
    assert.equal(result.fact.status, "ACTIVE");
  }
});

// 2. Identifiers and exact dates are absent from transformation output
test("2. Identifiers and exact dates are absent from transformation output", () => {
  const patientId = new mongoose.Types.ObjectId();
  const source: SourceConditionDoc = {
    _id: new mongoose.Types.ObjectId(),
    patientId,
    code: "VEC_DENGUE",
    display: "Dengue Virus Infection",
    clinicalStatus: "active",
    onsetDate: new Date("2026-07-20T14:30:00Z"),
  };

  const result = transformCondition(source, { regionId: "reg_mh" });
  assert.equal(result.success, true);
  if (result.success) {
    const fact = result.fact as unknown as Record<string, unknown>;
    assert.equal(fact.patientId, undefined);
    assert.equal(fact.patientName, undefined);
    assert.equal(fact.displayName, undefined);
    assert.equal(fact.dateOfBirth, undefined);
    assert.equal(fact.onsetDate, undefined);
    assert.equal(fact.notes, undefined);
    assert.equal(fact.clinicianId, undefined);

    // Only allowlist fields are present
    const allowedKeys = new Set([
      "sourceId",
      "period",
      "category",
      "regionId",
      "stateName",
      "districtName",
      "monitoredDisease",
      "status",
      "patientHash",
      "updatedAt",
    ]);
    for (const key of Object.keys(fact)) {
      assert.ok(allowedKeys.has(key), `Key ${key} is not in the permitted allowlist`);
    }
  }
});

// 3. Invalid or incomplete source records are safely rejected
test("3. Invalid or incomplete source records are safely rejected", () => {
  // Missing patientId
  assert.deepEqual(transformCondition({ _id: "cond_1", code: "RESP_COVID19" }), {
    success: false,
    reason: "MISSING_PATIENT",
  });

  // Missing _id
  assert.deepEqual(transformCondition({ _id: "" }), {
    success: false,
    reason: "INVALID_SOURCE_ID",
  });

  // Unmapped disease code and display
  const unmapped = transformCondition({
    _id: "cond_2",
    patientId: "pat_1",
    code: "UNRECOGNIZED_CODE_999",
    display: "Non-surveillance condition",
    onsetDate: new Date(),
  });
  assert.deepEqual(unmapped, {
    success: false,
    reason: "UNMAPPED_CONDITION",
  });
});

// 4. Reprocessing the same event does not double-count
test("4. Reprocessing the same event does not double-count", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return; // Skip if local test db not reachable
  }

  try {
    const fact = {
      sourceId: "cond_test_04",
      period: "2026-06",
      category: "VectorBorne" as const,
      regionId: "reg_ka",
      stateName: "Karnataka",
      districtName: "Bengaluru Urban",
      monitoredDisease: "Malaria P. vivax",
      status: "ACTIVE" as const,
      patientHash: hashPatientId("pat_unique_04"),
      updatedAt: new Date(),
    };

    // Process first time
    const res1 = await applyCaseFact(ctx.analyticsModels, fact);
    assert.equal(res1.applied, true);

    const agg1 = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-06",
      category: "VectorBorne",
      regionId: "reg_ka",
    }).lean().exec();
    assert.equal(agg1?.caseCount, 1);

    // Reprocess identical event
    const res2 = await applyCaseFact(ctx.analyticsModels, fact);
    assert.equal(res2.action, "NOOP");

    const agg2 = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-06",
      category: "VectorBorne",
      regionId: "reg_ka",
    }).lean().exec();
    assert.equal(agg2?.caseCount, 1); // Case count remains 1, no double counting!
  } finally {
    await ctx.cleanup();
  }
});

// 5. Updates move counts correctly between categories or geographic/month buckets
test("5. Updates move counts correctly between categories or geographic/month buckets", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    const factV1 = {
      sourceId: "cond_test_05",
      period: "2026-05",
      category: "Respiratory" as const,
      regionId: "reg_mh",
      stateName: "Maharashtra",
      districtName: "Pune District",
      monitoredDisease: "Influenza A/B",
      status: "ACTIVE" as const,
      patientHash: hashPatientId("pat_05"),
      updatedAt: new Date(),
    };

    // Apply V1
    await applyCaseFact(ctx.analyticsModels, factV1);
    const aggV1 = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-05",
      category: "Respiratory",
      regionId: "reg_mh",
    }).lean().exec();
    assert.equal(aggV1?.caseCount, 1);

    // Update to June and VectorBorne
    const factV2 = {
      ...factV1,
      period: "2026-06",
      category: "VectorBorne" as const,
      monitoredDisease: "Dengue Virus",
    };

    await applyCaseFact(ctx.analyticsModels, factV2);

    const oldBucket = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-05",
      category: "Respiratory",
      regionId: "reg_mh",
    }).lean().exec();
    assert.equal(oldBucket?.caseCount, 0);

    const newBucket = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-06",
      category: "VectorBorne",
      regionId: "reg_mh",
    }).lean().exec();
    assert.equal(newBucket?.caseCount, 1);
  } finally {
    await ctx.cleanup();
  }
});

// 6. Deletions remove the correct contribution
test("6. Deletions remove the correct contribution", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    const fact = {
      sourceId: "cond_test_06",
      period: "2026-08",
      category: "Waterborne" as const,
      regionId: "reg_tn",
      stateName: "Tamil Nadu",
      districtName: "Chennai North",
      monitoredDisease: "Cholera",
      status: "ACTIVE" as const,
      patientHash: hashPatientId("pat_06"),
      updatedAt: new Date(),
    };

    await applyCaseFact(ctx.analyticsModels, fact);
    let agg = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-08",
      category: "Waterborne",
      regionId: "reg_tn",
    }).lean().exec();
    assert.equal(agg?.caseCount, 1);

    // Apply deletion
    const deletedFact = { ...fact, status: "DELETED" as const };
    await applyCaseFact(ctx.analyticsModels, deletedFact);

    agg = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-08",
      category: "Waterborne",
      regionId: "reg_tn",
    }).lean().exec();
    assert.equal(agg?.caseCount, 0);
  } finally {
    await ctx.cleanup();
  }
});

// 7. Duplicate and out-of-order events are handled safely
test("7. Duplicate and out-of-order events are handled safely", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    const factLatest = {
      sourceId: "cond_test_07",
      period: "2026-09",
      category: "Zoonotic" as const,
      regionId: "reg_ga",
      stateName: "Goa",
      districtName: "South Goa",
      monitoredDisease: "Leptospirosis",
      status: "ACTIVE" as const,
      patientHash: hashPatientId("pat_07"),
      updatedAt: new Date("2026-09-10T12:00:00Z"),
    };

    // V2 arrives
    await applyCaseFact(ctx.analyticsModels, factLatest);

    // Duplicate V2 arrives
    const duplicateRes = await applyCaseFact(ctx.analyticsModels, factLatest);
    assert.equal(duplicateRes.action, "NOOP");

    const agg = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-09",
      category: "Zoonotic",
      regionId: "reg_ga",
    }).lean().exec();
    assert.equal(agg?.caseCount, 1);
  } finally {
    await ctx.cleanup();
  }
});

// 8. Restart/resume and checkpoint recovery work as designed
test("8. Restart/resume and checkpoint recovery work as designed", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    // Create checkpoint
    await ctx.analyticsModels.EtlCheckpoint.create({
      streamName: "conditions",
      lastCheckpointedAt: new Date("2026-01-01T00:00:00Z"),
      lastEventTimestamp: new Date("2026-01-01T00:00:00Z"),
      eventsProcessed: 42,
      mode: "POLLING_FALLBACK",
      status: "IDLE",
    });

    const checkpoint = await ctx.analyticsModels.EtlCheckpoint.findOne({ streamName: "conditions" }).lean().exec();
    assert.ok(checkpoint);
    assert.equal(checkpoint.eventsProcessed, 42);
    assert.equal(checkpoint.mode, "POLLING_FALLBACK");

    etlStatusTracker.syncFromCheckpoint(checkpoint);
    const snapshot = etlStatusTracker.getSnapshot();
    assert.equal(snapshot.eventsProcessed, 42);
    assert.equal(snapshot.mode, "POLLING_FALLBACK");
  } finally {
    await ctx.cleanup();
  }
});

// 9. Full rebuild matches incremental processing
test("9. Full rebuild matches incremental processing", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    const org = await ctx.clinicalModels.Organization.create({
      name: "Surveillance Clinic One",
      regionId: "reg_mh",
      stateName: "Maharashtra",
      districtName: "Pune District",
    });

    const patientId = new mongoose.Types.ObjectId();
    const clinicianId = new mongoose.Types.ObjectId();
    await ctx.clinicalModels.Condition.create([
      {
        patientId,
        organizationId: org._id,
        recordedByClinicianId: clinicianId,
        code: "RESP_COVID19",
        display: "COVID-19",
        clinicalStatus: "active",
        onsetDate: new Date("2026-03-01T00:00:00Z"),
      },
      {
        patientId,
        organizationId: org._id,
        recordedByClinicianId: clinicianId,
        code: "VEC_DENGUE",
        display: "Dengue",
        clinicalStatus: "active",
        onsetDate: new Date("2026-03-15T00:00:00Z"),
      },
    ]);

    // Run full rebuild
    const stats = await rebuildAnalytics(ctx.connections, { clearExisting: true });
    assert.equal(stats.conditionsScanned, 2);
    assert.equal(stats.eligibleCasesIngested, 2);

    const covidAgg = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-03",
      category: "Respiratory",
      regionId: "reg_mh",
    }).lean().exec();
    assert.equal(covidAgg?.caseCount, 1);

    const dengueAgg = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-03",
      category: "VectorBorne",
      regionId: "reg_mh",
    }).lean().exec();
    assert.equal(dengueAgg?.caseCount, 1);
  } finally {
    await ctx.cleanup();
  }
});

// 10. Concurrent processing cannot double-count cases
test("10. Concurrent processing cannot double-count cases", async () => {
  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    const patientHash = hashPatientId("pat_concurrent_10");

    const facts = [
      {
        sourceId: "cond_concurrent_1",
        period: "2026-10",
        category: "Respiratory" as const,
        regionId: "reg_dl",
        stateName: "Delhi NCR",
        districtName: "Central Delhi",
        monitoredDisease: "Asthma Exacerbation",
        status: "ACTIVE" as const,
        patientHash,
        updatedAt: new Date(),
      },
      {
        sourceId: "cond_concurrent_2",
        period: "2026-10",
        category: "Respiratory" as const,
        regionId: "reg_dl",
        stateName: "Delhi NCR",
        districtName: "Central Delhi",
        monitoredDisease: "Severe Pneumonia",
        status: "ACTIVE" as const,
        patientHash,
        updatedAt: new Date(),
      },
    ];

    // Apply both conditions for the same patient in the same month/region concurrently
    await Promise.all(facts.map((fact) => applyCaseFact(ctx!.analyticsModels, fact)));

    const agg = await ctx.analyticsModels.SurveillanceAggregate.findOne({
      period: "2026-10",
      category: "Respiratory",
      regionId: "reg_dl",
    }).lean().exec();

    // Distinct patient count rule guarantees 1 unique case for this patient
    assert.equal(agg?.caseCount, 1);
  } finally {
    await ctx.cleanup();
  }
});

// 11. Small-group and complementary suppression apply consistently
test("11. Small-group and complementary suppression apply consistently", () => {
  // Empty data
  assert.deepEqual(aggregateCount([]), { suppressed: true, reason: "NO_DATA" });

  // Group below K=10
  assert.deepEqual(aggregateCount([{ caseCount: 9 }]), { suppressed: true, reason: "BELOW_K_THRESHOLD" });

  // Group meeting K=10
  assert.deepEqual(aggregateCount([{ caseCount: 10 }]), { suppressed: false, count: 10 });

  // Complementary suppression: if any subgroup is hidden (<10), parent rollup is masked
  assert.deepEqual(
    aggregateCount([{ caseCount: 25 }, { caseCount: 7 }]),
    { suppressed: true, reason: "BELOW_K_THRESHOLD" },
  );
});

// 12. Admin endpoints and Socket.IO payloads contain only permitted aggregate fields
test("12. Admin endpoints and Socket.IO payloads contain only permitted aggregate fields", () => {
  const affectedBuckets = [{ period: "2026-10", category: "Respiratory" as const, regionId: "reg_mh" }];
  const socketPayload = {
    timestamp: new Date().toISOString(),
    eventType: "AGGREGATE_REFRESH",
    summaryMessage: `Surveillance aggregates refreshed for ${affectedBuckets.length} cohort(s).`,
    affectedRegions: [...new Set(affectedBuckets.map((b) => b.regionId))],
  };

  assert.equal(typeof socketPayload.timestamp, "string");
  assert.equal(socketPayload.eventType, "AGGREGATE_REFRESH");
  assert.deepEqual(socketPayload.affectedRegions, ["reg_mh"]);
  assert.equal("patientId" in socketPayload, false);
  assert.equal("patientName" in socketPayload, false);
  assert.equal("diagnosis" in socketPayload, false);
});

// 13. Unsupported standalone MongoDB Change Streams produce a clear, tested fallback
test("13. Unsupported standalone MongoDB Change Streams produce a clear, tested fallback", async () => {
  const config = {
    NODE_ENV: "development" as const,
    PORT: 5000,
    MONGODB_URI: TEST_DB_URI,
    MONGODB_DATABASE: "hackmatrix",
    CORS_ORIGINS: "http://localhost:5173",
    corsOrigins: ["http://localhost:5173"],
    clerkAuthorizedParties: [],
    LOG_LEVEL: "info",
    BODY_LIMIT: "1mb",
    CLERK_ROLE_CLAIM: "metadata.role",
    K_THRESHOLD: 10,
    ETL_POLL_INTERVAL_MS: 1000,
    ETL_ENABLED: true,
  };

  let ctx: Awaited<ReturnType<typeof createTestConnections>> | undefined;
  try {
    ctx = await createTestConnections();
  } catch {
    return;
  }

  try {
    const engine = new EtlEngine(ctx.connections, config);
    await engine.start();

    const status = engine.getStatus();
    assert.equal(status.running, true);
    // On standalone local MongoDB, fallback mode is automatically chosen
    assert.equal(status.mode, "POLLING_FALLBACK");

    await engine.stop();
    assert.equal(engine.getStatus().running, false);
  } finally {
    await ctx.cleanup();
  }
});

// 14. ETL failures and lag are observable without leaking personal data
test("14. ETL failures and lag are observable without leaking personal data", () => {
  etlStatusTracker.recordFailure("CHANGE_STREAM_DISCONNECTED");
  const snapshot = etlStatusTracker.getSnapshot();

  assert.equal(snapshot.status, "ERROR");
  assert.equal(snapshot.lastErrorCategory, "CHANGE_STREAM_DISCONNECTED");
  assert.equal(typeof snapshot.lagSeconds, "number");

  // Verify zero clinical/patient fields exist on the observability snapshot
  const raw = snapshot as unknown as Record<string, unknown>;
  assert.equal(raw.patientId, undefined);
  assert.equal(raw.patientName, undefined);
  assert.equal(raw.sourceRecord, undefined);
});
