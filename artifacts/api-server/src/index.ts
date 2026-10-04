import { createApp } from "./app";
import { loadConfig } from "./config/env";
import {
  connectDatabases,
  createDatabaseConnections,
  disconnectDatabases,
  type DatabaseConnections,
} from "./db";
import { logger } from "./lib/logger";

const config = loadConfig();
let connections: DatabaseConnections | undefined;

async function start(): Promise<void> {
  if (config.MONGODB_URI) {
    connections = createDatabaseConnections(config);
    await connectDatabases(connections);
  } else if (config.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is required in production.");
  } else {
    logger.warn("MONGODB_URI is not configured; /api/readyz will remain unavailable.");
  }

  const app = createApp({ config, connections });
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Server listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, "Error closing HTTP server");
        process.exitCode = 1;
      }
      await disconnectDatabases(connections);
    });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Server failed to start");
  process.exit(1);
});
