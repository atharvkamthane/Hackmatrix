import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const surveillanceCategories = [
  "Respiratory",
  "VectorBorne",
  "Waterborne",
  "Zoonotic",
] as const;

export type SurveillanceCategory = (typeof surveillanceCategories)[number];

const surveillanceAggregateSchema = new Schema(
  {
    period: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    category: { type: String, enum: surveillanceCategories, required: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    regionId: { type: String, required: true, trim: true, maxlength: 80 },
    stateName: { type: String, required: true, trim: true, maxlength: 80 },
    districtName: { type: String, trim: true, maxlength: 80 },
    caseCount: { type: Number, required: true, min: 0 },
    lastReportedAt: { type: Date, required: true },
    activeSurveillanceSites: { type: Number, min: 0 },
    coveragePercentage: { type: Number, min: 0, max: 100 },
    riskLevel: { type: String, enum: ["LOW", "MODERATE", "ELEVATED", "HIGH"] },
    monitoredDiseases: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    isSynthetic: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: "surveillanceAggregates", strict: "throw" },
);

surveillanceAggregateSchema.index(
  { period: 1, category: 1, regionId: 1 },
  { unique: true },
);
surveillanceAggregateSchema.index({ period: 1, stateName: 1, districtName: 1 });

export type SurveillanceAggregate = InferSchemaType<typeof surveillanceAggregateSchema>;

const etlCheckpointSchema = new Schema(
  {
    streamName: { type: String, required: true, unique: true, trim: true },
    resumeToken: { type: Schema.Types.Mixed },
    lastCheckpointedAt: { type: Date, required: true, default: Date.now },
    lastEventTimestamp: { type: Date, required: true, default: Date.now },
    eventsProcessed: { type: Number, required: true, default: 0, min: 0 },
    eventsSkipped: { type: Number, required: true, default: 0, min: 0 },
    eventsFailed: { type: Number, required: true, default: 0, min: 0 },
    mode: {
      type: String,
      enum: ["CHANGE_STREAM", "POLLING_FALLBACK"],
      required: true,
      default: "POLLING_FALLBACK",
    },
    status: {
      type: String,
      enum: ["RUNNING", "IDLE", "RECOVERING", "ERROR", "STOPPED"],
      required: true,
      default: "IDLE",
    },
    lastErrorCategory: { type: String, trim: true },
    lagSeconds: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: "etlCheckpoints" },
);

const etlLedgerSchema = new Schema(
  {
    sourceId: { type: String, required: true, unique: true, trim: true },
    period: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    category: { type: String, enum: surveillanceCategories, required: true },
    regionId: { type: String, required: true, trim: true, maxlength: 80 },
    stateName: { type: String, required: true, trim: true, maxlength: 80 },
    districtName: { type: String, trim: true, maxlength: 80 },
    monitoredDisease: { type: String, required: true, trim: true, maxlength: 120 },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "DELETED"],
      required: true,
      default: "ACTIVE",
    },
    patientHash: { type: String, required: true, trim: true, maxlength: 64 },
    version: { type: Number, required: true, default: 1 },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: "etlLedgers" },
);
etlLedgerSchema.index({ period: 1, category: 1, regionId: 1 });
etlLedgerSchema.index({ patientHash: 1, period: 1, category: 1, regionId: 1 });

export type EtlCheckpoint = InferSchemaType<typeof etlCheckpointSchema>;
export type EtlLedger = InferSchemaType<typeof etlLedgerSchema>;

export interface AnalyticsModels {
  SurveillanceAggregate: Model<SurveillanceAggregate>;
  EtlCheckpoint: Model<EtlCheckpoint>;
  EtlLedger: Model<EtlLedger>;
}

export function createAnalyticsModels(connection: Connection): AnalyticsModels {
  const plane = (connection as unknown as { plane?: string }).plane;
  if (plane && plane !== "analytics") {
    throw new Error(
      `Cannot register analytics models on ${plane} connection. Analytics models are restricted to the analytics data plane.`,
    );
  }
  const SurveillanceAggregate = (connection.models.SurveillanceAggregate as Model<SurveillanceAggregate> | undefined)
    ?? connection.model<SurveillanceAggregate>(
      "SurveillanceAggregate",
      surveillanceAggregateSchema,
    );
  const EtlCheckpoint = (connection.models.EtlCheckpoint as Model<EtlCheckpoint> | undefined)
    ?? connection.model<EtlCheckpoint>(
      "EtlCheckpoint",
      etlCheckpointSchema,
    );
  const EtlLedger = (connection.models.EtlLedger as Model<EtlLedger> | undefined)
    ?? connection.model<EtlLedger>(
      "EtlLedger",
      etlLedgerSchema,
    );
  return { SurveillanceAggregate, EtlCheckpoint, EtlLedger };
}