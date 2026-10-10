import type { Types } from "mongoose";
import type { SurveillanceCategory } from "../models/analytics";
import {
  normalizeConditionCategory,
  toReportingPeriod,
  resolveRegion,
  hashPatientId,
  type StandardRegion,
} from "./taxonomy";

export interface SourceConditionDoc {
  _id: Types.ObjectId | string;
  patientId?: Types.ObjectId | string;
  organizationId?: Types.ObjectId | string;
  code?: string;
  display?: string;
  clinicalStatus?: string;
  onsetDate?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface OrganizationLocationLookup {
  regionId?: string;
  stateName?: string;
  districtName?: string;
  organizationName?: string;
}

export interface TransformedCaseFact {
  sourceId: string;
  period: string;
  category: SurveillanceCategory;
  regionId: string;
  stateName: string;
  districtName: string;
  monitoredDisease: string;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  patientHash: string;
  updatedAt: Date;
}

export type TransformResult =
  | { success: true; fact: TransformedCaseFact }
  | { success: false; reason: "INVALID_SOURCE_ID" | "UNMAPPED_CONDITION" | "INVALID_PERIOD" | "MISSING_PATIENT" };

/**
 * Pure, deterministic transformation function that converts an eligible clinical Condition
 * into a privacy-safe surveillance aggregate fact using a strict allowlist.
 *
 * Guaranteed to NEVER include patient names, IDs, dates of birth, exact timestamps, or clinical notes.
 */
export function transformCondition(
  doc: SourceConditionDoc | null | undefined,
  orgLookup?: OrganizationLocationLookup,
  isExplicitDelete = false,
): TransformResult {
  if (!doc || !doc._id) {
    return { success: false, reason: "INVALID_SOURCE_ID" };
  }

  const sourceId = String(doc._id);

  if (isExplicitDelete) {
    // For deletions where document body might be partial:
    const period = toReportingPeriod(doc.onsetDate || doc.createdAt || new Date()) || "2026-01";
    const mapped = normalizeConditionCategory(doc.code, doc.display) || {
      category: "Respiratory",
      standardName: "Unknown",
    };
    const region = resolveRegion(orgLookup);
    return {
      success: true,
      fact: {
        sourceId,
        period,
        category: mapped.category,
        regionId: region.regionId,
        stateName: region.stateName,
        districtName: region.districtName,
        monitoredDisease: mapped.standardName,
        status: "DELETED",
        patientHash: hashPatientId(doc.patientId || sourceId),
        updatedAt: new Date(),
      },
    };
  }

  if (!doc.patientId) {
    return { success: false, reason: "MISSING_PATIENT" };
  }

  // 1. Normalize disease category
  const diseaseMapping = normalizeConditionCategory(doc.code, doc.display);
  if (!diseaseMapping) {
    return { success: false, reason: "UNMAPPED_CONDITION" };
  }

  // 2. Compute calendar month reporting period
  const rawDate = doc.onsetDate || doc.createdAt;
  const period = toReportingPeriod(rawDate);
  if (!period) {
    return { success: false, reason: "INVALID_PERIOD" };
  }

  // 3. Resolve location
  const region: StandardRegion = resolveRegion(orgLookup);

  // 4. Determine surveillance status
  const rawStatus = (doc.clinicalStatus ?? "active").toLowerCase().trim();
  const status: "ACTIVE" | "INACTIVE" = rawStatus === "inactive" ? "INACTIVE" : "ACTIVE";

  // 5. Deterministic pseudonym hash for patient (zero direct ID)
  const patientHash = hashPatientId(doc.patientId);

  // 6. Updated timestamp
  const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : new Date();

  // Strict allowlist: only permitted surveillance dimensions are returned
  return {
    success: true,
    fact: {
      sourceId,
      period,
      category: diseaseMapping.category,
      regionId: region.regionId,
      stateName: region.stateName,
      districtName: region.districtName,
      monitoredDisease: diseaseMapping.standardName,
      status,
      patientHash,
      updatedAt,
    },
  };
}
