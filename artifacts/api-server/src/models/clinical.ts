import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

export const clinicalScopes = ["visits", "prescriptions", "labs"] as const;
export type ClinicalScope = (typeof clinicalScopes)[number];

export const roles = ["PATIENT", "CLINICIAN", "ADMIN"] as const;
export type ClinicalRole = (typeof roles)[number];

const organizationId = {
  type: Schema.Types.ObjectId,
  ref: "Organization",
  required: true,
  index: true,
} as const;

const userId = {
  type: Schema.Types.ObjectId,
  ref: "User",
  required: true,
} as const;

const patientId = {
  type: Schema.Types.ObjectId,
  ref: "Patient",
  required: true,
} as const;

const clinicianId = {
  type: Schema.Types.ObjectId,
  ref: "Clinician",
  required: true,
} as const;

const userSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: roles, required: true },
    organizationId,
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  { timestamps: true, collection: "users" },
);
userSchema.index({ organizationId: 1, role: 1 });

const organizationSchema = new Schema(
  {
    clerkOrganizationId: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
  },
  { timestamps: true, collection: "organizations" },
);

const patientSchema = new Schema(
  {
    userId: { ...userId, unique: true },
    organizationId,
    displayName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    identityStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true, collection: "patients" },
);
patientSchema.index({ organizationId: 1 });

const clinicianSchema = new Schema(
  {
    userId: { ...userId, unique: true },
    organizationId,
    displayName: { type: String, required: true, trim: true },
    professionalId: { type: String, required: true, trim: true },
    identityStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true, collection: "clinicians" },
);
clinicianSchema.index({ organizationId: 1 });
clinicianSchema.index({ organizationId: 1, professionalId: 1 }, { unique: true });

const encounterSchema = new Schema(
  {
    patientId,
    clinicianId,
    organizationId,
    status: {
      type: String,
      enum: ["planned", "in-progress", "finished", "cancelled"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    endedAt: Date,
    reason: { type: String, trim: true },
  },
  { timestamps: true, collection: "encounters" },
);
encounterSchema.index({ patientId: 1, organizationId: 1 });

const conditionSchema = new Schema(
  {
    patientId,
    organizationId,
    recordedByClinicianId: clinicianId,
    code: { type: String, required: true, trim: true },
    display: { type: String, required: true, trim: true },
    clinicalStatus: {
      type: String,
      enum: ["active", "resolved", "inactive"],
      required: true,
    },
    onsetDate: Date,
  },
  { timestamps: true, collection: "conditions" },
);
conditionSchema.index({ patientId: 1, organizationId: 1 });

const medicationRequestSchema = new Schema(
  {
    patientId,
    clinicianId,
    organizationId,
    medication: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      required: true,
    },
    authoredOn: { type: Date, required: true },
    dosageInstruction: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: "medicationRequests" },
);
medicationRequestSchema.index({ patientId: 1, organizationId: 1 });

const observationSchema = new Schema(
  {
    patientId,
    clinicianId,
    organizationId,
    code: { type: String, required: true, trim: true },
    display: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    observedAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "observations" },
);
observationSchema.index({ patientId: 1, organizationId: 1 });

const qrTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, trim: true },
    patientId,
    expiresAt: { type: Date, required: true, index: true },
    usedAt: Date,
    revokedAt: Date,
    createdByUserId: userId,
    creationIp: { type: String, trim: true },
    creationUserAgent: { type: String, trim: true },
  },
  { timestamps: true, collection: "qrTokens" },
);
qrTokenSchema.index({ tokenHash: 1, expiresAt: 1 }, { unique: true });
qrTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const decisionSchema = new Schema(
  {
    decidedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reasonCode: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const accessRequestSchema = new Schema(
  {
    patientId,
    clinicianId,
    organizationId,
    requestedScopes: {
      type: [{ type: String, enum: clinicalScopes }],
      required: true,
      validate: {
        validator: (value: ClinicalScope[]) => value.length > 0,
        message: "At least one access scope is required.",
      },
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED", "EXPIRED"],
      required: true,
      default: "PENDING",
      index: true,
    },
    createdAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    decidedAt: Date,
    decision: decisionSchema,
  },
  { timestamps: true, collection: "accessRequests" },
);
accessRequestSchema.index({ organizationId: 1, status: 1 });
accessRequestSchema.index({ patientId: 1, status: 1 });

const accessGrantSchema = new Schema(
  {
    patientId,
    clinicianId,
    organizationId,
    scopes: {
      type: [{ type: String, enum: clinicalScopes }],
      required: true,
      validate: {
        validator: (value: ClinicalScope[]) => value.length > 0,
        message: "At least one grant scope is required.",
      },
    },
    issuedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    status: {
      type: String,
      enum: ["ACTIVE", "REVOKED", "EXPIRED"],
      required: true,
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true, collection: "accessGrants" },
);
accessGrantSchema.index({ status: 1, expiresAt: 1 });
accessGrantSchema.index({ patientId: 1, clinicianId: 1, organizationId: 1 });

const auditLogSchema = new Schema(
  {
    actorUserId: { type: String, required: true, trim: true },
    actorRole: { type: String, enum: roles, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    action: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true, trim: true },
    resourceReference: { type: String, required: true, trim: true },
    result: {
      type: String,
      enum: ["SUCCESS", "DENIED", "FAILURE"],
      required: true,
    },
    correlationId: { type: String, required: true, trim: true },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true, collection: "auditLogs" },
);
auditLogSchema.index({ occurredAt: -1 });
auditLogSchema.index({ organizationId: 1, occurredAt: -1 });

export type User = InferSchemaType<typeof userSchema>;
export type Organization = InferSchemaType<typeof organizationSchema>;
export type Patient = InferSchemaType<typeof patientSchema>;
export type Clinician = InferSchemaType<typeof clinicianSchema>;
export type Encounter = InferSchemaType<typeof encounterSchema>;
export type Condition = InferSchemaType<typeof conditionSchema>;
export type MedicationRequest = InferSchemaType<typeof medicationRequestSchema>;
export type Observation = InferSchemaType<typeof observationSchema>;
export type QRToken = InferSchemaType<typeof qrTokenSchema>;
export type AccessRequest = InferSchemaType<typeof accessRequestSchema>;
export type AccessGrant = InferSchemaType<typeof accessGrantSchema>;
export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export interface ClinicalModels {
  User: Model<User>;
  Organization: Model<Organization>;
  Patient: Model<Patient>;
  Clinician: Model<Clinician>;
  Encounter: Model<Encounter>;
  Condition: Model<Condition>;
  MedicationRequest: Model<MedicationRequest>;
  Prescription: Model<MedicationRequest>;
  Observation: Model<Observation>;
  QRToken: Model<QRToken>;
  AccessRequest: Model<AccessRequest>;
  AccessGrant: Model<AccessGrant>;
  AuditLog: Model<AuditLog>;
}

function getOrCreate<T>(
  connection: Connection,
  name: string,
  schema: Schema<T>,
): Model<T> {
  return (connection.models[name] as Model<T> | undefined) ??
    connection.model<T>(name, schema);
}

export function createClinicalModels(connection: Connection): ClinicalModels {
  const models = {
    User: getOrCreate(connection, "User", userSchema),
    Organization: getOrCreate(connection, "Organization", organizationSchema),
    Patient: getOrCreate(connection, "Patient", patientSchema),
    Clinician: getOrCreate(connection, "Clinician", clinicianSchema),
    Encounter: getOrCreate(connection, "Encounter", encounterSchema),
    Condition: getOrCreate(connection, "Condition", conditionSchema),
    MedicationRequest: getOrCreate(connection, "MedicationRequest", medicationRequestSchema),
    Observation: getOrCreate(connection, "Observation", observationSchema),
    QRToken: getOrCreate(connection, "QRToken", qrTokenSchema),
    AccessRequest: getOrCreate(connection, "AccessRequest", accessRequestSchema),
    AccessGrant: getOrCreate(connection, "AccessGrant", accessGrantSchema),
    AuditLog: getOrCreate(connection, "AuditLog", auditLogSchema),
  };
  return { ...models, Prescription: models.MedicationRequest };
}

export type ClinicalObjectId = Types.ObjectId;
