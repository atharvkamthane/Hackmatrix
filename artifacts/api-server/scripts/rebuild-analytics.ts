import path from "node:path";
import mongoose from "mongoose";

if (typeof process.loadEnvFile === "function") {
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const candidate of envCandidates) {
    try {
      process.loadEnvFile(candidate);
      break;
    } catch {
      // .env optional
    }
  }
}

import { loadConfig } from "../src/config/env";
import { createDatabaseConnections, disconnectDatabases } from "../src/db/connections";
import { rebuildAnalytics } from "../src/etl/rebuild";

async function main(): Promise<void> {
  const rawConfig = loadConfig();
  const mongoUri = rawConfig.MONGODB_URI || (rawConfig.NODE_ENV !== "production" ? "mongodb://127.0.0.1:27017" : undefined);
  const config = { ...rawConfig, ...(mongoUri ? { MONGODB_URI: mongoUri } : {}) };

  if (!config.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to rebuild analytics.");
  }

  const connections = createDatabaseConnections(config);

  try {
    await Promise.all([
      connections.clinical.asPromise(),
      connections.analytics.asPromise(),
    ]);

    const stats = await rebuildAnalytics(connections, { clearExisting: true });
    console.log("Analytics Rebuild Results:");
    console.log(`- Scanned conditions: ${stats.conditionsScanned}`);
    console.log(`- Eligible cases ingested: ${stats.eligibleCasesIngested}`);
    console.log(`- Skipped records: ${stats.skipped}`);
    console.log(`- Buckets recomputed: ${stats.bucketsRecomputed}`);
    console.log(`- Duration: ${stats.durationMs}ms`);
  } finally {
    await disconnectDatabases(connections);
    await mongoose.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("Rebuild failed:", err);
  process.exitCode = 1;
});
