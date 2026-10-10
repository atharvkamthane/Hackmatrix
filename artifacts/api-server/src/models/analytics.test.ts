import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createAnalyticsModels } from "./analytics";
import { aggregateCount } from "../routes/admin-analytics";

test("admin aggregate suppression hides empty and below-threshold groups", () => {
  assert.deepEqual(aggregateCount([]), { suppressed: true, reason: "NO_DATA" });
  assert.deepEqual(aggregateCount([{ caseCount: 9 }]), { suppressed: true, reason: "BELOW_K_THRESHOLD" });
  assert.deepEqual(aggregateCount([{ caseCount: 10 }]), { suppressed: false, count: 10 });
  assert.deepEqual(aggregateCount([{ caseCount: 10 }, { caseCount: 9 }]), {
    suppressed: true,
    reason: "BELOW_K_THRESHOLD",
  });
});

test("surveillance aggregate model excludes patient-level fields", () => {
  const connection = mongoose.createConnection();
  (connection as unknown as { plane: string }).plane = "analytics";
  const { SurveillanceAggregate } = createAnalyticsModels(connection);

  assert.equal(SurveillanceAggregate.schema.path("patientId"), undefined);
  assert.equal(SurveillanceAggregate.schema.path("patientName"), undefined);
  assert.ok(SurveillanceAggregate.schema.path("caseCount"));
});

test("surveillance aggregate rows validate period, category, and count", async () => {
  const connection = mongoose.createConnection();
  (connection as unknown as { plane: string }).plane = "analytics";
  const { SurveillanceAggregate } = createAnalyticsModels(connection);
  const aggregate = new SurveillanceAggregate({
    period: "2026-13",
    category: "Unknown",
    displayName: "Example category",
    regionId: "region_1",
    stateName: "Example state",
    caseCount: -1,
    lastReportedAt: new Date(),
  });

  await assert.rejects(aggregate.validate());
});

test("clinical connection cannot register analytics models", () => {
  const connection = mongoose.createConnection();
  (connection as unknown as { plane: string }).plane = "clinical";

  assert.throws(() => createAnalyticsModels(connection), /restricted to the analytics data plane/);
});