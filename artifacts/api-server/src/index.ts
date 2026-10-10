import path from "node:path";
import http from "http";
import type { Request } from "express";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), ".env"));
  } catch {
    try {
      process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
    } catch {
      // .env optional
    }
  }
}

async function startServer(): Promise<void> {
  const [{ loadConfig }, database, { createClinicalModels, createAnalyticsModels }, { createApp }, { createClerkVerifier }, { logger }, { initSocketServer }] =
    await Promise.all([
      import("./config/env"),
      import("./db"),
      import("./models"),
      import("./app"),
      import("./auth"),
      import("./lib/logger"),
      import("./socket"),
    ]);
  const config = loadConfig();
  const connections = database.createDatabaseConnections(config);
  let server: http.Server | undefined;

  try {
    await database.connectDatabases(connections);
    const models = createClinicalModels(connections.clinical);
    const analyticsModels = createAnalyticsModels(connections.analytics);
    await Promise.all([
      models.User.createIndexes(),
      models.Organization.createIndexes(),
      models.Patient.createIndexes(),
      models.Clinician.createIndexes(),
      models.Encounter.createIndexes(),
      models.Condition.createIndexes(),
      models.MedicationRequest.createIndexes(),
      models.Observation.createIndexes(),
      models.QRToken.createIndexes(),
      models.AccessRequest.createIndexes(),
      models.AccessGrant.createIndexes(),
      models.AuditLog.createIndexes(),
      analyticsModels.SurveillanceAggregate.createIndexes(),
      connections.analytics.collection("auditLogs").createIndex({ occurredAt: -1 }),
    ]);
    const verifyClerkRequest = config.CLERK_SECRET_KEY
      ? createClerkVerifier(config)
      : async () => null;
    const findInternalUser = async (clerkUserId: string) => {
      const user = await models.User.findOne({ clerkUserId }).lean().exec();
      if (!user) return null;
      return {
        clerkUserId: user.clerkUserId,
        role: user.role,
        organizationId: user.organizationId.toString(),
        status: user.status,
      };
    };
    const app = createApp({
      config,
      connections,
      verifyClerkRequest,
      findInternalUser,
    });

    server = http.createServer(app);
    initSocketServer(server, config.corsOrigins, async (token, headers) => {
      const authorization = `Bearer ${token}`;
      const socketRequest = {
        protocol: headers["x-forwarded-proto"]?.toString().split(",")[0] || "http",
        get: (name: string) => name.toLowerCase() === "authorization"
          ? authorization
          : headers[name.toLowerCase()],
        originalUrl: "/socket.io/",
        method: "GET",
        headers: { ...headers, authorization },
      } as Request;
      const identity = await verifyClerkRequest(socketRequest);
      if (!identity) return false;
      const user = await findInternalUser(identity.userId);
      return user?.role === "ADMIN" && user.status === "active";
    });
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(config.PORT, () => resolve());
    });
    logger.info({ port: config.PORT }, "HackMatrix API Server listening with Socket.IO enabled");

    for (const [name, connection] of Object.entries(connections)) {
      connection.on("error", () => logger.error({ connection: name }, "MongoDB connection error"));
      connection.on("disconnected", () => logger.warn({ connection: name }, "MongoDB connection lost"));
      connection.on("connected", () => logger.info({ connection: name }, "MongoDB connection restored"));
    }

    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      void (async () => {
        try {
          await new Promise<void>((resolve, reject) => {
            server?.close((error) => error ? reject(error) : resolve());
          });
          await database.disconnectDatabases(connections);
          logger.info({ signal }, "HackMatrix API Server shut down cleanly");
        } catch {
          logger.error({ signal }, "HackMatrix API Server shutdown failed");
          process.exitCode = 1;
        }
      })();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    if (server?.listening) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    await database.disconnectDatabases(connections).catch(() => undefined);
    logger.error(
      { errorName: error instanceof Error ? error.name : "UnknownError" },
      "HackMatrix API Server failed to start",
    );
    process.exitCode = 1;
  }
}

void startServer();
