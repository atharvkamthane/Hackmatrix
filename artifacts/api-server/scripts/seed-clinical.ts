import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({
  path: [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")],
});

import { loadConfig } from "../src/config/env";
import { createDatabaseConnections, disconnectDatabases } from "../src/db/connections";
import { createClinicalModels } from "../src/models";

const config = loadConfig({ ...process.env, NODE_ENV: "development" });
if (!config.MONGODB_URI) {
  throw new Error("MONGODB_URI is required to seed clinical data.");
}

const connections = createDatabaseConnections(config);
const models = createClinicalModels(connections.clinical);
const seedDate = new Date("2026-01-01T00:00:00.000Z");

async function seed(): Promise<void> {
  await connections.clinical.asPromise();
  await Promise.all(Object.values(models).map((entry) => entry.createIndexes()));

  await Promise.all([
    models.AuditLog.deleteMany({ actorUserId: /^seed_/ }),
    models.Observation.deleteMany({ value: /^synthetic:/ }),
    models.MedicationRequest.deleteMany({ medication: /^Synthetic/ }),
    models.Condition.deleteMany({ code: /^SYN-/ }),
    models.Encounter.deleteMany({ reason: /^Synthetic/ }),
    models.Patient.deleteMany({ displayName: /^Synthetic/ }),
    models.Clinician.deleteMany({ displayName: /^Synthetic/ }),
    models.User.deleteMany({ clerkUserId: /^user_seed_/ }),
    models.Organization.deleteMany({ clerkOrganizationId: /^org_seed_/ }),
  ]);

  const organizations = await models.Organization.create([
    { clerkOrganizationId: "org_seed_alpha", name: "Synthetic Alpha Clinic" },
    { clerkOrganizationId: "org_seed_beta", name: "Synthetic Beta Clinic" },
  ]);
  const users = await models.User.create([
    { clerkUserId: "user_seed_patient_1", role: "PATIENT", organizationId: organizations[0]._id },
    { clerkUserId: "user_seed_patient_2", role: "PATIENT", organizationId: organizations[1]._id },
    { clerkUserId: "user_seed_clinician_1", role: "CLINICIAN", organizationId: organizations[0]._id },
    { clerkUserId: "user_seed_clinician_2", role: "CLINICIAN", organizationId: organizations[1]._id },
  ]);
  const patients = await models.Patient.create([
    { userId: users[0]._id, organizationId: organizations[0]._id, displayName: "Synthetic Patient One", dateOfBirth: new Date("1990-01-01") },
    { userId: users[1]._id, organizationId: organizations[1]._id, displayName: "Synthetic Patient Two", dateOfBirth: new Date("1985-05-15") },
  ]);
  const clinicians = await models.Clinician.create([
    { userId: users[2]._id, organizationId: organizations[0]._id, displayName: "Synthetic Clinician One", professionalId: "SYN-CLIN-001" },
    { userId: users[3]._id, organizationId: organizations[1]._id, displayName: "Synthetic Clinician Two", professionalId: "SYN-CLIN-002" },
  ]);

  await models.Encounter.create([
    { patientId: patients[0]._id, clinicianId: clinicians[0]._id, organizationId: organizations[0]._id, status: "finished", startedAt: seedDate, endedAt: new Date(seedDate.getTime() + 30 * 60_000), reason: "Synthetic annual visit" },
    { patientId: patients[1]._id, clinicianId: clinicians[1]._id, organizationId: organizations[1]._id, status: "finished", startedAt: seedDate, endedAt: new Date(seedDate.getTime() + 45 * 60_000), reason: "Synthetic follow-up visit" },
  ]);
  await models.Condition.create([
    { patientId: patients[0]._id, organizationId: organizations[0]._id, recordedByClinicianId: clinicians[0]._id, code: "SYN-COND-001", display: "Synthetic seasonal allergy", clinicalStatus: "active", onsetDate: seedDate },
    { patientId: patients[1]._id, organizationId: organizations[1]._id, recordedByClinicianId: clinicians[1]._id, code: "SYN-COND-002", display: "Synthetic resolved condition", clinicalStatus: "resolved", onsetDate: seedDate },
  ]);
  await models.MedicationRequest.create([
    { patientId: patients[0]._id, clinicianId: clinicians[0]._id, organizationId: organizations[0]._id, medication: "Synthetic Medication A", status: "active", authoredOn: seedDate, dosageInstruction: "Take once daily" },
    { patientId: patients[1]._id, clinicianId: clinicians[1]._id, organizationId: organizations[1]._id, medication: "Synthetic Medication B", status: "completed", authoredOn: seedDate, dosageInstruction: "Take as directed" },
  ]);
  await models.Observation.create([
    { patientId: patients[0]._id, clinicianId: clinicians[0]._id, organizationId: organizations[0]._id, code: "SYN-OBS-001", display: "Synthetic temperature", value: "36.8", unit: "C", observedAt: seedDate },
    { patientId: patients[1]._id, clinicianId: clinicians[1]._id, organizationId: organizations[1]._id, code: "SYN-OBS-002", display: "Synthetic pulse", value: "72", unit: "bpm", observedAt: seedDate },
  ]);

  console.log("Synthetic clinical seed completed.");
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabases(connections);
    await mongoose.disconnect();
  });
