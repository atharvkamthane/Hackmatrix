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
 * Clinical and analytics use separate Mongoose connections and model boundaries
 * inside one database. The collections remain logically separated, but this is
 * not database-level access isolation when both connections share credentials.
 *
 * These connections share one URI and database, so they do not provide credential-level
 * isolation. Production deployments need separately scoped MongoDB users/custom roles and
 * a controlled aggregate ingestion process before treating the data planes as isolated.
 */
export function createDatabaseConnections(config: AppConfig): DatabaseConnections {
  if (!config.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to create database connections.");
  }

  const clinical = mongoose.createConnection(config.MONGODB_URI, {
    dbName: config.MONGODB_DATABASE,
    serverSelectionTimeoutMS: 5_000,
  });
  (clinical as unknown as { plane: string }).plane = "clinical";

  const analytics = mongoose.createConnection(config.MONGODB_URI, {
    dbName: config.MONGODB_DATABASE,
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
