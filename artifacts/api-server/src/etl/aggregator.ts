import type { AnalyticsModels, SurveillanceCategory } from "../models/analytics";
import type { TransformedCaseFact } from "./transformer";

export interface AggregateUpdateResult {
  applied: boolean;
  action: "CREATED" | "UPDATED" | "DELETED" | "NOOP";
  affectedBuckets: Array<{
    period: string;
    category: SurveillanceCategory;
    regionId: string;
  }>;
}

/**
 * Idempotently applies a transformed clinical case fact to the analytics data plane.
 *
 * Uses the isolated `etlLedger` to detect previous contributions, preventing double counting
 * across duplicate Change Stream events, out-of-order delivery, or restarts.
 */
export async function applyCaseFact(
  models: AnalyticsModels,
  fact: TransformedCaseFact,
): Promise<AggregateUpdateResult> {
  const existingLedger = await models.EtlLedger.findOne({ sourceId: fact.sourceId }).lean().exec();

  const prevActive = existingLedger ? existingLedger.status === "ACTIVE" : false;
  const currActive = fact.status === "ACTIVE";

  const prevBucket = prevActive && existingLedger
    ? { period: existingLedger.period, category: existingLedger.category as SurveillanceCategory, regionId: existingLedger.regionId }
    : null;
  const currBucket = currActive
    ? { period: fact.period, category: fact.category, regionId: fact.regionId }
    : null;

  // Check if no-op (same bucket, same active state)
  const isSameBucket =
    prevBucket &&
    currBucket &&
    prevBucket.period === currBucket.period &&
    prevBucket.category === currBucket.category &&
    prevBucket.regionId === currBucket.regionId;

  if (prevActive === currActive && isSameBucket) {
    // Identical contribution, simply update ledger timestamp and disease list without modifying counts
    await models.EtlLedger.updateOne(
      { sourceId: fact.sourceId },
      {
        $set: {
          processedAt: new Date(),
          monitoredDisease: fact.monitoredDisease,
        },
        $inc: { version: 1 },
      },
    );
    return { applied: false, action: "NOOP", affectedBuckets: [] };
  }

  const affectedBuckets: Array<{ period: string; category: SurveillanceCategory; regionId: string }> = [];

  // 1. If previous bucket existed and was active, remove its contribution or recompute
  if (prevBucket && (!currBucket || !isSameBucket)) {
    affectedBuckets.push(prevBucket);
  }

  // 2. If new bucket exists and is active, add its contribution
  if (currBucket && (!prevBucket || !isSameBucket)) {
    affectedBuckets.push(currBucket);
  }

  // 3. Update the ledger document
  await models.EtlLedger.updateOne(
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

  // 4. Recompute the exact case counts for all affected buckets based on distinct active patients
  for (const bucket of affectedBuckets) {
    await recomputeBucket(models, bucket.period, bucket.category, bucket.regionId, fact.stateName, fact.districtName);
  }

  const action = !existingLedger
    ? "CREATED"
    : fact.status === "DELETED"
      ? "DELETED"
      : "UPDATED";

  return { applied: true, action, affectedBuckets };
}

/**
 * Recomputes the aggregate for a specific (period, category, regionId) bucket
 * using distinct patient count from the ETL ledger.
 */
export async function recomputeBucket(
  models: AnalyticsModels,
  period: string,
  category: SurveillanceCategory,
  regionId: string,
  fallbackState = "Maharashtra",
  fallbackDistrict = "Pune District",
): Promise<number> {
  const distinctPatients = await models.EtlLedger.distinct("patientHash", {
    period,
    category,
    regionId,
    status: "ACTIVE",
  });

  const distinctDiseases = await models.EtlLedger.distinct("monitoredDisease", {
    period,
    category,
    regionId,
    status: "ACTIVE",
  });

  const caseCount = distinctPatients.length;

  const sampleDoc = await models.EtlLedger.findOne({
    period,
    category,
    regionId,
    status: "ACTIVE",
  }).lean().exec();

  const stateName = sampleDoc?.stateName || fallbackState;
  const districtName = sampleDoc?.districtName || fallbackDistrict;

  await models.SurveillanceAggregate.updateOne(
    { period, category, regionId },
    {
      $set: {
        caseCount,
        displayName: category,
        stateName,
        districtName,
        lastReportedAt: new Date(),
        monitoredDiseases: distinctDiseases,
        isSynthetic: false,
      },
    },
    { upsert: true },
  );

  return caseCount;
}
