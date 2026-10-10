import { Types, type mongo } from "mongoose";
type ChangeStream = mongo.ChangeStream;
type Document = Record<string, unknown>;
import type { DatabaseConnections } from "../db/connections";
import type { AppConfig } from "../config/env";
import { createClinicalModels, type ClinicalModels } from "../models/clinical";
import { createAnalyticsModels, type AnalyticsModels, type SurveillanceCategory } from "../models/analytics";
import { transformCondition, type OrganizationLocationLookup, type SourceConditionDoc } from "./transformer";
import { applyCaseFact } from "./aggregator";
import { etlStatusTracker, type EtlStatusSnapshot } from "./status";
import { logger } from "../lib/logger";

export type BucketUpdateCallback = (affectedBuckets: Array<{
  period: string;
  category: SurveillanceCategory;
  regionId: string;
}>) => void;

export class EtlEngine {
  private running = false;
  private changeStream: ChangeStream | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessingPoll = false;
  private lastPollDate: Date = new Date(0);
  private clinicalModels: ClinicalModels;
  private analyticsModels: AnalyticsModels;
  private orgLookupMap = new Map<string, OrganizationLocationLookup>();

  constructor(
    private connections: DatabaseConnections,
    private config: AppConfig,
    private onBucketsUpdated?: BucketUpdateCallback,
  ) {
    this.clinicalModels = createClinicalModels(connections.clinical);
    this.analyticsModels = createAnalyticsModels(connections.analytics);
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      // 1. Refresh organization location metadata
      await this.refreshOrgMap();

      // 2. Load or initialize checkpoint
      const checkpoint = await this.analyticsModels.EtlCheckpoint.findOne({ streamName: "conditions" }).lean().exec();
      if (checkpoint) {
        etlStatusTracker.syncFromCheckpoint(checkpoint);
        if (checkpoint.lastEventTimestamp) {
          this.lastPollDate = new Date(checkpoint.lastEventTimestamp);
        }
      } else {
        await this.analyticsModels.EtlCheckpoint.create({
          streamName: "conditions",
          lastCheckpointedAt: new Date(),
          lastEventTimestamp: new Date(),
          eventsProcessed: 0,
          eventsSkipped: 0,
          eventsFailed: 0,
          mode: "POLLING_FALLBACK",
          status: "IDLE",
        });
      }

      // 3. Inspect MongoDB topology to determine streaming vs polling capability
      const supportsChangeStreams = await this.checkChangeStreamSupport();

      if (supportsChangeStreams) {
        try {
          await this.startChangeStream(checkpoint?.resumeToken);
          etlStatusTracker.setRunning(true, "CHANGE_STREAM");
          logger.info("ETL Engine running with MongoDB Change Streams");
          return;
        } catch (csError) {
          logger.warn(
            { error: csError instanceof Error ? csError.message : String(csError) },
            "Failed to initialize Change Stream; falling back to polling engine",
          );
        }
      } else {
        logger.info(
          "MongoDB deployment is standalone (or lacks replica-set oplog); starting reliable polling fallback engine",
        );
      }

      // Start polling fallback
      this.startPollingFallback();
      etlStatusTracker.setRunning(true, "POLLING_FALLBACK");
    } catch (startError) {
      this.running = false;
      etlStatusTracker.recordFailure("STARTUP_ERROR");
      logger.error(
        { error: startError instanceof Error ? startError.message : String(startError) },
        "Failed to start ETL Engine",
      );
    }
  }

  public async stop(): Promise<void> {
    this.running = false;

    if (this.changeStream) {
      try {
        await this.changeStream.close();
      } catch {
        // ignore close error
      }
      this.changeStream = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    etlStatusTracker.setRunning(false, "POLLING_FALLBACK");
    await this.analyticsModels.EtlCheckpoint.updateOne(
      { streamName: "conditions" },
      { $set: { status: "STOPPED", lastCheckpointedAt: new Date() } },
    ).catch(() => undefined);

    logger.info("ETL Engine stopped cleanly");
  }

  public getStatus(): EtlStatusSnapshot {
    return etlStatusTracker.getSnapshot();
  }

  /**
   * Probes MongoDB topology to check if replica set Change Streams are supported.
   */
  private async checkChangeStreamSupport(): Promise<boolean> {
    try {
      const db = this.connections.clinical.db;
      if (!db) return false;
      const admin = db.admin();
      const hello = await admin.command({ hello: 1 });
      return Boolean(hello.setName || hello.msg === "isdbgrid");
    } catch {
      return false;
    }
  }

  private async refreshOrgMap(): Promise<void> {
    try {
      const orgs = await this.clinicalModels.Organization.find().lean().exec();
      this.orgLookupMap.clear();
      for (const org of orgs) {
        this.orgLookupMap.set(org._id.toString(), {
          regionId: org.regionId ?? undefined,
          stateName: org.stateName ?? undefined,
          districtName: org.districtName ?? undefined,
          organizationName: org.name,
        });
      }
    } catch (err) {
      logger.warn({ error: err instanceof Error ? err.message : String(err) }, "Could not refresh organization metadata");
    }
  }

  private async startChangeStream(resumeToken: unknown): Promise<void> {
    const options: Record<string, unknown> = {
      fullDocument: "updateLookup",
    };
    if (resumeToken) {
      options.resumeAfter = resumeToken;
    }

    this.changeStream = this.clinicalModels.Condition.watch([], options);

    this.changeStream.on("change", (change: Document) => {
      void this.handleChangeStreamEvent(change);
    });

    this.changeStream.on("error", (error: Error) => {
      logger.warn({ error: error.message }, "Change stream error encountered; switching to polling fallback");
      if (this.running) {
        if (this.changeStream) {
          void this.changeStream.close().catch(() => undefined);
          this.changeStream = null;
        }
        this.startPollingFallback();
        etlStatusTracker.setRunning(true, "POLLING_FALLBACK");
      }
    });
  }

  private async handleChangeStreamEvent(change: Document): Promise<void> {
    const resumeToken = change._id;
    const operationType = change.operationType as string;

    try {
      let isDelete = false;
      let rawDoc: SourceConditionDoc | null = null;

      if (operationType === "delete") {
        isDelete = true;
        const docKey = change.documentKey as { _id?: unknown } | undefined;
        rawDoc = { _id: String(docKey?._id ?? "") };
      } else if (change.fullDocument) {
        rawDoc = change.fullDocument as SourceConditionDoc;
      }

      if (rawDoc) {
        await this.processSingleDoc(rawDoc, isDelete, resumeToken);
      }
    } catch (err) {
      etlStatusTracker.recordFailure("CHANGE_STREAM_PROCESS_ERROR");
      logger.error({ error: err instanceof Error ? err.message : String(err) }, "Failed to process change stream event");
    }
  }

  private startPollingFallback(): void {
    if (this.pollTimer) return;
    const intervalMs = this.config.ETL_POLL_INTERVAL_MS || 2000;

    // Trigger immediate poll
    void this.pollCycle();

    this.pollTimer = setInterval(() => {
      void this.pollCycle();
    }, intervalMs);
  }

  public async pollCycle(): Promise<number> {
    if (!this.running || this.isProcessingPoll) return 0;
    this.isProcessingPoll = true;

    try {
      await this.refreshOrgMap();

      // Query conditions updated since last check
      const query = this.lastPollDate.getTime() > 0
        ? { updatedAt: { $gte: new Date(this.lastPollDate.getTime() - 1000) } }
        : {};

      const docs = await this.clinicalModels.Condition.find(query)
        .sort({ updatedAt: 1 })
        .limit(100)
        .lean()
        .exec();

      let processedCount = 0;
      for (const doc of docs) {
        const docUpdated = doc.updatedAt ? new Date(doc.updatedAt) : new Date();
        await this.processSingleDoc(doc as SourceConditionDoc, false);
        if (docUpdated > this.lastPollDate) {
          this.lastPollDate = docUpdated;
        }
        processedCount += 1;
      }

      // Standalone MongoDB polling deletion detection:
      // Reconcile active ledger records against clinical conditions to capture deletions
      const activeLedgers = await this.analyticsModels.EtlLedger.find({ status: "ACTIVE" })
        .select({ sourceId: 1 })
        .lean()
        .exec();

      if (activeLedgers.length > 0) {
        const sourceIds = activeLedgers.map((l) => l.sourceId);
        const sourceObjectIds = sourceIds
          .map((id) => {
            try {
              return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
            } catch {
              return null;
            }
          })
          .filter((id): id is Types.ObjectId => id !== null);

        const existingConditions = await this.clinicalModels.Condition.find({
          _id: { $in: sourceObjectIds },
        })
          .select({ _id: 1 })
          .lean()
          .exec();

        const existingIdSet = new Set(existingConditions.map((c) => c._id.toString()));

        for (const ledger of activeLedgers) {
          if (!existingIdSet.has(ledger.sourceId)) {
            await this.processSingleDoc({ _id: ledger.sourceId }, true);
            processedCount += 1;
          }
        }
      }

      if (processedCount > 0) {
        await this.analyticsModels.EtlCheckpoint.updateOne(
          { streamName: "conditions" },
          {
            $set: {
              lastCheckpointedAt: new Date(),
              lastEventTimestamp: this.lastPollDate,
              status: "IDLE",
            },
          },
        );
      }

      return processedCount;
    } catch (pollError) {
      etlStatusTracker.recordFailure("POLLING_CYCLE_ERROR");
      logger.error({ error: pollError instanceof Error ? pollError.message : String(pollError) }, "Error in ETL polling cycle");
      return 0;
    } finally {
      this.isProcessingPoll = false;
    }
  }

  public async processSingleDoc(
    doc: SourceConditionDoc,
    isDelete = false,
    resumeToken?: unknown,
  ): Promise<void> {
    const orgIdStr = doc.organizationId ? doc.organizationId.toString() : undefined;
    const orgLookup = orgIdStr ? this.orgLookupMap.get(orgIdStr) : undefined;

    const result = transformCondition(doc, orgLookup, isDelete);

    if (!result.success) {
      etlStatusTracker.recordSkip();
      return;
    }

    const res = await applyCaseFact(this.analyticsModels, result.fact);

    etlStatusTracker.recordSuccess(result.fact.updatedAt);

    // Durable checkpoint update
    const updatePayload: Record<string, unknown> = {
      lastCheckpointedAt: new Date(),
      lastEventTimestamp: result.fact.updatedAt,
      status: "RUNNING",
    };
    if (resumeToken) {
      updatePayload.resumeToken = resumeToken;
    }

    await this.analyticsModels.EtlCheckpoint.updateOne(
      { streamName: "conditions" },
      {
        $set: updatePayload,
        $inc: { eventsProcessed: 1 },
      },
      { upsert: true },
    );

    if (res.applied && res.affectedBuckets.length > 0 && this.onBucketsUpdated) {
      this.onBucketsUpdated(res.affectedBuckets);
    }
  }
}
