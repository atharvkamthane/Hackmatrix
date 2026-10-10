import { createHash } from "node:crypto";
import type { SurveillanceCategory } from "../models/analytics";

export interface StandardRegion {
  regionId: string;
  stateName: string;
  districtName: string;
}

export const APPROVED_REGIONS: Record<string, StandardRegion> = {
  reg_mh: { regionId: "reg_mh", stateName: "Maharashtra", districtName: "Pune District" },
  reg_dl: { regionId: "reg_dl", stateName: "Delhi NCR", districtName: "Central Delhi" },
  reg_ka: { regionId: "reg_ka", stateName: "Karnataka", districtName: "Bengaluru Urban" },
  reg_tn: { regionId: "reg_tn", stateName: "Tamil Nadu", districtName: "Chennai North" },
  reg_ga: { regionId: "reg_ga", stateName: "Goa", districtName: "South Goa" },
};

export const DEFAULT_REGION: StandardRegion = APPROVED_REGIONS.reg_mh;

interface DiseaseMapping {
  category: SurveillanceCategory;
  standardName: string;
}

const DISEASE_REGISTRY: Record<string, DiseaseMapping> = {
  // Respiratory
  "SYN-COND-001": { category: "Respiratory", standardName: "Synthetic seasonal allergy" },
  "RESP_INFLUENZA": { category: "Respiratory", standardName: "Influenza A/B" },
  "RESP_COVID19": { category: "Respiratory", standardName: "COVID-19" },
  "RESP_RSV": { category: "Respiratory", standardName: "RSV" },
  "RESP_PNEUMONIA": { category: "Respiratory", standardName: "Severe Pneumonia" },
  "RESP_ASTHMA_EXAC": { category: "Respiratory", standardName: "Asthma Exacerbation" },
  "J00-J22": { category: "Respiratory", standardName: "Acute Respiratory Infection" },

  // Vector-Borne
  "VEC_DENGUE": { category: "VectorBorne", standardName: "Dengue Virus" },
  "VEC_MALARIA_PV": { category: "VectorBorne", standardName: "Malaria P. vivax" },
  "VEC_MALARIA_PF": { category: "VectorBorne", standardName: "Malaria P. falciparum" },
  "VEC_CHIKUNGUNYA": { category: "VectorBorne", standardName: "Chikungunya" },
  "A90-A91": { category: "VectorBorne", standardName: "Dengue Fever" },
  "B50-B54": { category: "VectorBorne", standardName: "Malaria" },

  // Waterborne
  "WATER_CHOLERA": { category: "Waterborne", standardName: "Cholera" },
  "WATER_TYPHOID": { category: "Waterborne", standardName: "Typhoid Fever" },
  "WATER_GE": { category: "Waterborne", standardName: "Acute Gastroenteritis" },
  "WATER_DIARRHEA": { category: "Waterborne", standardName: "Diarrheal Disease" },
  "A00-A09": { category: "Waterborne", standardName: "Intestinal Infectious Diseases" },

  // Zoonotic
  "ZOO_LEPTO": { category: "Zoonotic", standardName: "Leptospirosis" },
  "ZOO_BRUCELLA": { category: "Zoonotic", standardName: "Brucellosis" },
  "ZOO_RABIES": { category: "Zoonotic", standardName: "Rabies" },
  "ZOO_KFD": { category: "Zoonotic", standardName: "Kyasanur Forest Disease" },
  "A20-A28": { category: "Zoonotic", standardName: "Zoonotic Bacterial Diseases" },
};

/**
 * Normalizes clinical condition codes or descriptive displays into an approved surveillance category.
 */
export function normalizeConditionCategory(
  code: string | undefined,
  display?: string,
): DiseaseMapping | null {
  if (!code && !display) return null;
  const cleanCode = (code ?? "").trim().toUpperCase();

  // 1. Direct code lookup
  if (DISEASE_REGISTRY[cleanCode]) {
    return DISEASE_REGISTRY[cleanCode];
  }

  // 2. Pattern-based code matches
  if (/^(RESP|INFLUENZA|COVID|RSV|PNEUMONIA|J[0-2][0-9])/i.test(cleanCode)) {
    return { category: "Respiratory", standardName: display?.trim() || "Acute Respiratory Infection" };
  }
  if (/^(VEC|DENGUE|MALARIA|CHIK|A9[0-1]|B5[0-4])/i.test(cleanCode)) {
    return { category: "VectorBorne", standardName: display?.trim() || "Vector-Borne Disease" };
  }
  if (/^(WATER|CHOLERA|TYPHOID|GASTRO|A0[0-9])/i.test(cleanCode)) {
    return { category: "Waterborne", standardName: display?.trim() || "Waterborne Illness" };
  }
  if (/^(ZOO|LEPTO|BRUCELLA|RABIES|KFD|A2[0-8])/i.test(cleanCode)) {
    return { category: "Zoonotic", standardName: display?.trim() || "Zoonotic Infection" };
  }

  // 3. Normalized display matching for clinical text
  const cleanDisplay = (display ?? "").trim().toLowerCase();
  if (/respiratory|influenza|covid|rsv|pneumonia|asthma|bronchitis|allergy/i.test(cleanDisplay)) {
    return { category: "Respiratory", standardName: display?.trim() || "Acute Respiratory Infection" };
  }
  if (/dengue|malaria|chikungunya|zika/i.test(cleanDisplay)) {
    return { category: "VectorBorne", standardName: display?.trim() || "Vector-Borne Disease" };
  }
  if (/cholera|typhoid|diarrhea|gastroenteritis|waterborne/i.test(cleanDisplay)) {
    return { category: "Waterborne", standardName: display?.trim() || "Waterborne Illness" };
  }
  if (/leptospirosis|brucellosis|rabies|kyasanur|zoonotic|anthrax/i.test(cleanDisplay)) {
    return { category: "Zoonotic", standardName: display?.trim() || "Zoonotic Infection" };
  }

  return null;
}

/**
 * Converts a clinical timestamp/date to UTC calendar month string: YYYY-MM.
 */
export function toReportingPeriod(date: Date | string | number | null | undefined): string | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Resolves a clinical organization or district metadata to a validated standard region.
 */
export function resolveRegion(orgMeta?: {
  regionId?: string;
  stateName?: string;
  districtName?: string;
  organizationName?: string;
}): StandardRegion {
  if (orgMeta?.regionId && APPROVED_REGIONS[orgMeta.regionId]) {
    return APPROVED_REGIONS[orgMeta.regionId];
  }

  const text = `${orgMeta?.stateName ?? ""} ${orgMeta?.districtName ?? ""} ${orgMeta?.organizationName ?? ""}`.toLowerCase();
  if (text.includes("delhi") || text.includes("ncr")) return APPROVED_REGIONS.reg_dl;
  if (text.includes("karnataka") || text.includes("bengaluru") || text.includes("bangalore")) return APPROVED_REGIONS.reg_ka;
  if (text.includes("tamil") || text.includes("chennai")) return APPROVED_REGIONS.reg_tn;
  if (text.includes("goa")) return APPROVED_REGIONS.reg_ga;
  if (text.includes("maharashtra") || text.includes("pune") || text.includes("mumbai") || text.includes("alpha")) return APPROVED_REGIONS.reg_mh;
  if (text.includes("beta")) return APPROVED_REGIONS.reg_dl;

  return DEFAULT_REGION;
}

/**
 * Calculates coarse age band from date of birth without exposing DOB.
 */
export function toCoarseAgeBand(dateOfBirth: Date | undefined): "<18" | "18-49" | "50-64" | "65+" | "UNKNOWN" {
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) return "UNKNOWN";
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  if (
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }
  if (age < 18) return "<18";
  if (age <= 49) return "18-49";
  if (age <= 64) return "50-64";
  return "65+";
}

/**
 * Produces a one-way deterministic pseudonym hash of a patient ID for localized deduplication.
 * Never stores raw patient IDs in analytics documents.
 */
export function hashPatientId(patientId: unknown): string {
  const str = String(patientId ?? "").trim();
  return createHash("sha256").update(`HM_SURVEILLANCE_SALT_${str}`).digest("hex");
}
