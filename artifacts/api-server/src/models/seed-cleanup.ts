import type { createClinicalModels } from "./clinical";

export const SEED_ORGANIZATION_CLERK_IDS = ["org_seed_alpha", "org_seed_beta"] as const;
export const SEED_USER_CLERK_IDS = [
  "user_seed_patient_1",
  "user_seed_patient_2",
  "user_seed_clinician_1",
  "user_seed_clinician_2",
] as const;

/**
 * Selectively deletes only records created by the seed script using explicit
 * identifier boundaries (SEED_ORGANIZATION_CLERK_IDS and SEED_USER_CLERK_IDS).
 * Unrelated synthetic-looking records or real clinical records are safely preserved.
 */
export async function cleanupSeededRecords(models: ReturnType<typeof createClinicalModels>): Promise<void> {
  const existingOrgs = await models.Organization.find({
    clerkOrganizationId: { $in: SEED_ORGANIZATION_CLERK_IDS },
  }).select("_id");
  const orgIds = existingOrgs.map((o) => o._id);

  const existingUsers = await models.User.find({
    clerkUserId: { $in: SEED_USER_CLERK_IDS },
  }).select("_id");
  const userIds = existingUsers.map((u) => u._id);

  const existingPatients = await models.Patient.find({
    userId: { $in: userIds },
  }).select("_id");
  const patientIds = existingPatients.map((p) => p._id);

  const existingClinicians = await models.Clinician.find({
    userId: { $in: userIds },
  }).select("_id");
  const clinicianIds = existingClinicians.map((c) => c._id);

  await Promise.all([
    models.AuditLog.deleteMany({ actorUserId: { $in: [...SEED_USER_CLERK_IDS] } }),
    models.Observation.deleteMany({ patientId: { $in: patientIds } }),
    models.MedicationRequest.deleteMany({ patientId: { $in: patientIds } }),
    models.Condition.deleteMany({ patientId: { $in: patientIds } }),
    models.Encounter.deleteMany({ patientId: { $in: patientIds } }),
    models.Patient.deleteMany({ _id: { $in: patientIds } }),
    models.Clinician.deleteMany({ _id: { $in: clinicianIds } }),
    models.User.deleteMany({ _id: { $in: userIds } }),
    models.Organization.deleteMany({ _id: { $in: orgIds } }),
  ]);
}
