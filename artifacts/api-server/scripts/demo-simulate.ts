import mongoose from "mongoose";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hackmatrix";
const DEMO_TAG = "DEMO_SURVEILLANCE_SIMULATION";

async function run() {
  const mode = process.argv[2] || "add";
  console.log(`\n🩺 HackMatrix Clinical-to-Analytics Live Demo Script`);
  console.log(`Connecting to: ${MONGO_URI}`);

  const conn = mongoose.createConnection(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await conn.asPromise();

  const orgsColl = conn.collection("organizations");
  const conditionsColl = conn.collection("conditions");

  if (mode === "clear") {
    const res = await conditionsColl.deleteMany({ display: { $regex: DEMO_TAG } });
    console.log(`\n🧹 Cleaned up ${res.deletedCount} demo condition(s).`);
    console.log(`The ETL engine will detect this deletion on its next cycle and decrement the aggregate counts.\n`);
    await conn.close();
    return;
  }

  // 1. Ensure a standard demo organization with approved region exists
  let org = await orgsColl.findOne({ name: "Pune District Surveillance Center" });
  if (!org) {
    const inserted = await orgsColl.insertOne({
      name: "Pune District Surveillance Center",
      regionId: "reg_mh",
      stateName: "Maharashtra",
      districtName: "Pune District",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    org = { _id: inserted.insertedId };
  }

  // 2. Insert 12 confirmed Dengue cases (crossing K=10 privacy threshold)
  const clinicianId = new mongoose.Types.ObjectId();
  const docs = [];
  for (let i = 1; i <= 12; i++) {
    docs.push({
      patientId: new mongoose.Types.ObjectId(),
      organizationId: org._id,
      recordedByClinicianId: clinicianId,
      code: "VEC_DENGUE",
      display: `Dengue Virus [${DEMO_TAG} #${i}]`,
      clinicalStatus: "active",
      onsetDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const result = await conditionsColl.insertMany(docs);
  console.log(`\n✅ Successfully simulated clinician recording ${result.insertedCount} Dengue cases!`);
  console.log(`   Location: Maharashtra (Pune District) [regionId: reg_mh]`);
  console.log(`   Disease Category: VectorBorne`);
  console.log(`   Privacy Cohort: N=12 (crosses K=10 threshold to unlock aggregate display)\n`);
  console.log(`📺 WHAT TO WATCH NOW:`);
  console.log(`   1. Open the Admin Dashboard: http://localhost:5173`);
  console.log(`   2. In 5-10 seconds, the ETL engine picks up these cases from the clinical collection.`);
  console.log(`   3. The dashboard receives a real-time WebSocket update and automatically bumps the Vector-Borne trend!`);
  console.log(`   4. Notice that ZERO patient names or IDs were sent to the analytics layer.`);
  console.log(`\n💡 To remove these demo records later, run:`);
  console.log(`   npx pnpm --dir artifacts/api-server run demo:clear\n`);

  await conn.close();
}

run().catch((err) => {
  console.error("Demo simulation error:", err);
  process.exit(1);
});
