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

export interface AnalyticsModels {
  SurveillanceAggregate: Model<SurveillanceAggregate>;
}

export function createAnalyticsModels(connection: Connection): AnalyticsModels {
  const plane = (connection as unknown as { plane?: string }).plane;
  if (plane && plane !== "analytics") {
    throw new Error(
      `Cannot register analytics models on ${plane} connection. Analytics models are restricted to the analytics data plane.`,
    );
  }
  const model = (connection.models.SurveillanceAggregate as Model<SurveillanceAggregate> | undefined)
    ?? connection.model<SurveillanceAggregate>(
      "SurveillanceAggregate",
      surveillanceAggregateSchema,
    );
  return { SurveillanceAggregate: model };
}