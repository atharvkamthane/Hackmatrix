import mongoose from "mongoose";
import { createClinicalModels } from "../src/models/clinical";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hackmatrix";

async function main() {
  const args = process.argv.slice(2);
  let clerkId = "";
  let role: "PATIENT" | "CLINICIAN" | "ADMIN" = "PATIENT";
  let name = "";
  let orgName = "Harbor Health Clinic";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--clerkId" && args[i + 1]) clerkId = args[++i];
    if (args[i] === "--role" && args[i + 1]) role = args[++i].toUpperCase() as any;
    if (args[i] === "--name" && args[i + 1]) name = args[++i];
    if (args[i] === "--org" && args[i + 1]) orgName = args[++i];
  }

  if (!clerkId) {
    console.error("Usage: node --import tsx scripts/provision-user.ts --clerkId <id> --role <PATIENT|CLINICIAN> [--name <name>] [--org <org>]");
    process.exit(1);
  }

  if (!["PATIENT", "CLINICIAN", "ADMIN"].includes(role)) {
    console.error(`Invalid role: ${role}. Must be PATIENT, CLINICIAN, or ADMIN.`);
    process.exit(1);
  }

  name = name || (role === "CLINICIAN" ? "Dr. Priya Nair" : "Amara Shah");

  console.log(`Connecting to database: ${MONGO_URI}`);
  const conn = mongoose.createConnection(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await conn.asPromise();

  const models = createClinicalModels(conn);

  let org = await models.Organization.findOne({ name: orgName });
  if (!org) {
    org = await models.Organization.create({
      name: orgName,
      regionId: "reg_mh",
      stateName: "Maharashtra",
      districtName: "Pune District",
      status: "active",
    });
    console.log(`Created organization: ${org.name} (${org._id})`);
  }

  const existingUser = await models.User.findOne({ clerkUserId: clerkId });
  if (existingUser) {
    console.log(`User ${clerkId} already exists in database with role ${existingUser.role}.`);
    await conn.close();
    return;
  }

  const user = await models.User.create({
    clerkUserId: clerkId,
    role,
    organizationId: org._id,
    status: "active",
  });
  console.log(`Created user: ${user.clerkUserId} -> Role: ${user.role}`);

  if (role === "PATIENT") {
    const patient = await models.Patient.create({
      userId: user._id,
      organizationId: org._id,
      displayName: name,
      dateOfBirth: new Date("1994-06-12"),
      identityStatus: "active",
    });
    console.log(`Created patient profile: ${patient.displayName} (${patient._id})`);
  } else if (role === "CLINICIAN") {
    const clinician = await models.Clinician.create({
      userId: user._id,
      organizationId: org._id,
      displayName: name.startsWith("Dr.") ? name : `Dr. ${name}`,
      professionalId: `MED-${Math.floor(10000 + Math.random() * 90000)}`,
      identityStatus: "active",
    });
    console.log(`Created clinician profile: ${clinician.displayName} (${clinician._id})`);
  }

  await conn.close();
  console.log("Provisioning completed successfully.");
}

main().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});
