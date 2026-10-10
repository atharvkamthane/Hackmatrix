import mongoose, { type Connection } from "mongoose";
import type { AppConfig } from "../config/env";

export interface DatabaseReadiness {
  clinical: boolean;
  analytics: boolean;
}

export interface DatabaseConnections {
  clinical: Connection;
  analytics: Connection;
}

/**
 * Note on Database-Level Isolation:
 * Creating two Mongoose connections with distinct database names (e.g., MONGODB_CLINICAL_DB
 * and MONGODB_ANALYTICS_DB) using a shared MONGODB_URI credential provides logical separation,
 * but does NOT enforce database-level access isolation.
 *
 * For full database-level isolation, MongoDB Atlas least-privilege users must be provisioned:
 * 1. clinical_rw: Read/write permissions strictly on the clinical database.
 * 2. analytics_ro: Read-only permissions strictly on the analytics database for admin queries.
 * 3. etl_worker: Read access on clinical collections, read/write on analytics collections.
 */
export function createDatabaseConnections(config: AppConfig): DatabaseConnections {
  if (!config.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to create database connections.");
  }

  const clinical = mongoose.createConnection(config.MONGODB_URI, {
    dbName: config.MONGODB_CLINICAL_DB,
    serverSelectionTimeoutMS: 5_000,
  });
  (clinical as unknown as { plane: string }).plane = "clinical";

  const analytics = mongoose.createConnection(config.MONGODB_URI, {
    dbName: config.MONGODB_ANALYTICS_DB,
    serverSelectionTimeoutMS: 5_000,
  });
  (analytics as unknown as { plane: string }).plane = "analytics";

  return { clinical, analytics };
}

export async function connectDatabases(
  connections: DatabaseConnections,
): Promise<void> {
  await Promise.all([
    connections.clinical.asPromise(),
    connections.analytics.asPromise(),
  ]);
}

export function getDatabaseReadiness(
  connections: DatabaseConnections | undefined,
): DatabaseReadiness {
  return {
    clinical: connections?.clinical.readyState === 1,
    analytics: connections?.analytics.readyState === 1,
  };
}

export function areDatabasesReady(
  connections: DatabaseConnections | undefined,
): boolean {
  const readiness = getDatabaseReadiness(connections);
  return readiness.clinical && readiness.analytics;
}

export async function disconnectDatabases(
  connections: DatabaseConnections | undefined,
): Promise<void> {
  if (!connections) return;
  await Promise.all([connections.clinical.close(), connections.analytics.close()]);
}
