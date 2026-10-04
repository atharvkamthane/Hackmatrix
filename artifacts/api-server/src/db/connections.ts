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

export function createDatabaseConnections(config: AppConfig): DatabaseConnections {
  if (!config.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to create database connections.");
  }

  return {
    clinical: mongoose.createConnection(config.MONGODB_URI, {
      dbName: config.MONGODB_CLINICAL_DB,
      serverSelectionTimeoutMS: 5_000,
    }),
    analytics: mongoose.createConnection(config.MONGODB_URI, {
      dbName: config.MONGODB_ANALYTICS_DB,
      serverSelectionTimeoutMS: 5_000,
    }),
  };
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
