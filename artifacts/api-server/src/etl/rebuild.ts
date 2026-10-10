import type { DatabaseConnections } from "../db/connections";
import { createClinicalModels } from "../models/clinical";
import { createAnalyticsModels, type SurveillanceCategory } from "../models/analytics";
import { transformCondition } from "./transformer";
import { recomputeBucket } from "./aggregator";
import { etlStatusTracker } from "./status";
import { logger } from "../lib/logger";

export interface RebuildOptions {
  clearExisting?: boolean;
}

export interface RebuildStats {
  conditionsScanned: number;
  eligibleCasesIngested: number;
  skipped: number;
  bucketsRecomputed: number;
  durationMs: number;
}

/**
 * Executes a safe, idempotent full rebuild of the analytics surveillance aggregates
 * from eligible clinical records.
 *
 * Never exposes clinical records, patient IDs, or PII to the caller or admin UI.
 */
export async function rebuildAnalytics(
  connections: DatabaseConnections,
  options: RebuildOptions = {},
): Promise<RebuildStats> {
  const startTime = Date.now();
  const clinicalModels = createClinicalModels(connections.clinical);
  const analyticsModels = createAnalyticsModels(connections.analytics);

  etlStatusTracker.setStatus("RECOVERING");
  logger.info("Starting full analytics rebuild from clinical data plane");

  // 1. Load organization location mapping
  const organizations = await clinicalModels.Organization.find().lean().exec();
  const orgMap = new Map<string, { regionId?: string; stateName?: string; districtName?: string; organizationName?: string }>();
  for (const org of organizations) {
    orgMap.set(org._id.toString(), {
      regionId: org.regionId ?? undefined,
      stateName: org.stateName ?? undefined,
      districtName: org.districtName ?? undefined,
      organizationName: org.name,
    });
  }

  // 2. Optionally reset ledgers
  if (options.clearExisting) {
    await analyticsModels.EtlLedger.deleteMany({});
    // Delete non-synthetic aggregates
    await analyticsModels.SurveillanceAggregate.deleteMany({ isSynthetic: false });
  }

  // 3. Scan all clinical conditions in batches
  const conditions = await clinicalModels.Condition.find().sort({ createdAt: 1 }).lean().exec();
  let eligibleCount = 0;
  let skippedCount = 0;

  const distinctBuckets = new Map<string, { period: string; category: SurveillanceCategory; regionId: string; state: string; district: string }>();

  for (const condition of conditions) {
    const orgLookup = condition.organizationId ? orgMap.get(condition.organizationId.toString()) : undefined;
    const result = transformCondition(condition, orgLookup);

    if (!result.success) {
      skippedCount += 1;
      continue;
    }

    const fact = result.fact;
    eligibleCount += 1;

    // Upsert into ETL ledger
    await analyticsModels.EtlLedger.updateOne(
      { sourceId: fact.sourceId },
      {
        $set: {
          period: fact.period,
          category: fact.category,
          regionId: fact.regionId,
          stateName: fact.stateName,
          districtName: fact.districtName,
          monitoredDisease: fact.monitoredDisease,
          status: fact.status,
          patientHash: fact.patientHash,
          processedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { upsert: true },
    );

    const bucketKey = `${fact.period}:${fact.category}:${fact.regionId}`;
    if (!distinctBuckets.has(bucketKey)) {
      distinctBuckets.set(bucketKey, {
        period: fact.period,
        category: fact.category,
        regionId: fact.regionId,
        state: fact.stateName,
        district: fact.districtName,
      });
    }
  }

  // 4. Recompute all distinct aggregate buckets
  for (const bucket of distinctBuckets.values()) {
    await recomputeBucket(
      analyticsModels,
      bucket.period,
      bucket.category,
      bucket.regionId,
      bucket.state,
      bucket.district,
    );
  }

  // 5. Update checkpoint
  await analyticsModels.EtlCheckpoint.updateOne(
    { streamName: "conditions" },
    {
      $set: {
        lastCheckpointedAt: new Date(),
        lastEventTimestamp: new Date(),
        eventsProcessed: eligibleCount,
        eventsSkipped: skippedCount,
        status: "IDLE",
      },
    },
    { upsert: true },
  );

  const durationMs = Date.now() - startTime;
  etlStatusTracker.setStatus("IDLE");
  logger.info({ eligibleCount, skippedCount, buckets: distinctBuckets.size, durationMs }, "Analytics full rebuild completed");

  return {
    conditionsScanned: conditions.length,
    eligibleCasesIngested: eligibleCount,
    skipped: skippedCount,
    bucketsRecomputed: distinctBuckets.size,
    durationMs,
  };
}
