import path from "node:path";
import http from "http";
import type { Request } from "express";
import type { DatabaseConnections } from "./db";

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
  const rawConfig = loadConfig();
  const mongoUri = rawConfig.MONGODB_URI || (rawConfig.NODE_ENV !== "production" ? "mongodb://127.0.0.1:27017" : undefined);
  const config = { ...rawConfig, ...(mongoUri ? { MONGODB_URI: mongoUri } : {}) };

  let connections: DatabaseConnections | undefined;
  let models: ReturnType<typeof createClinicalModels> | undefined;
  let analyticsModels: ReturnType<typeof createAnalyticsModels> | undefined;
  let server: http.Server | undefined;
  let etlEngine: { start: () => Promise<void>; stop: () => Promise<void> } | undefined;

  try {
    if (config.MONGODB_URI) {
      try {
        connections = database.createDatabaseConnections(config);
        await database.connectDatabases(connections);
        models = createClinicalModels(connections.clinical);
        analyticsModels = createAnalyticsModels(connections.analytics);
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
          analyticsModels.EtlCheckpoint.createIndexes(),
          analyticsModels.EtlLedger.createIndexes(),
          connections.analytics.collection("auditLogs").createIndex({ occurredAt: -1 }),
        ]);
        logger.info("MongoDB connected and indexes verified");
      } catch (dbErr) {
        if (config.NODE_ENV === "production") {
          throw dbErr;
        }
        if (config.MONGODB_URI && !config.MONGODB_URI.includes("127.0.0.1") && !config.MONGODB_URI.includes("localhost")) {
          try {
            logger.warn("Primary MongoDB connection failed; attempting fallback to local MongoDB (127.0.0.1:27017)...");
            const localConfig = {
              ...config,
              MONGODB_URI: "mongodb://127.0.0.1:27017",
              CLINICAL_MONGODB_URI: undefined,
              ANALYTICS_MONGODB_URI: undefined,
            };
            connections = database.createDatabaseConnections(localConfig);
            await database.connectDatabases(connections);
            models = createClinicalModels(connections.clinical);
            analyticsModels = createAnalyticsModels(connections.analytics);
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
              analyticsModels.EtlCheckpoint.createIndexes(),
              analyticsModels.EtlLedger.createIndexes(),
              connections.analytics.collection("auditLogs").createIndex({ occurredAt: -1 }),
            ]);
            logger.info("Connected to local MongoDB fallback and verified indexes");
          } catch {
            logger.warn(
              { error: dbErr instanceof Error ? dbErr.message : String(dbErr) },
              "MongoDB connection failed; starting server in degraded mode without database",
            );
            if (connections) {
              await database.disconnectDatabases(connections).catch(() => undefined);
              connections = undefined;
            }
          }
        } else {
          logger.warn(
            { error: dbErr instanceof Error ? dbErr.message : String(dbErr) },
            "MongoDB connection failed; starting server in degraded mode without database",
          );
          if (connections) {
            await database.disconnectDatabases(connections).catch(() => undefined);
            connections = undefined;
          }
        }
      }
    } else {
      logger.warn("MONGODB_URI not provided; starting server in degraded mode without database");
    }

    const verifyClerkRequest = config.CLERK_SECRET_KEY
      ? createClerkVerifier(config)
      : async () => null;
    const findInternalUser = async (clerkUserId: string) => {
      if (!models) return null;
      let user = await models.User.findOne({ clerkUserId }).lean().exec();
      if (!user && config.NODE_ENV !== "production" && clerkUserId === "user_dev_admin") {
        let adminOrg = await models.Organization.findOne({ name: "National Disease Surveillance Agency" });
        if (!adminOrg) {
          adminOrg = await models.Organization.create({
            clerkOrganizationId: "org_admin_surveillance",
            name: "National Disease Surveillance Agency",
            regionId: "reg_dl",
            stateName: "Delhi NCR",
            districtName: "Central Delhi",
            status: "active",
          });
        }
        const createdUser = await models.User.create({
          clerkUserId: "user_dev_admin",
          role: "ADMIN",
          organizationId: adminOrg._id,
          status: "active",
        });
        return {
          clerkUserId: createdUser.clerkUserId,
          role: createdUser.role,
          organizationId: createdUser.organizationId.toString(),
          status: createdUser.status,
        };
      }
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
      if (config.NODE_ENV !== "production" && (token === "dev_admin_token" || token === "demo_token")) {
        return true;
      }
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

    if (connections && config.ETL_ENABLED) {
      const { EtlEngine } = await import("./etl");
      const { getSocketServer } = await import("./socket");
      etlEngine = new EtlEngine(connections, config, (affectedBuckets) => {
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.emit("analytics:update", {
            timestamp: new Date().toISOString(),
            eventType: "AGGREGATE_REFRESH",
            summaryMessage: `Surveillance aggregates refreshed for ${affectedBuckets.length} cohort(s).`,
            affectedRegions: [...new Set(affectedBuckets.map((b) => b.regionId))],
          });
        }
      });
      await etlEngine.start();
    }

    if (connections) {
      for (const [name, connection] of [["clinical", connections.clinical], ["analytics", connections.analytics]] as const) {
        connection.on("error", () => logger.error({ connection: name }, "MongoDB connection error"));
        connection.on("disconnected", () => logger.warn({ connection: name }, "MongoDB connection lost"));
        connection.on("connected", () => logger.info({ connection: name }, "MongoDB connection restored"));
      }
    }

    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      void (async () => {
        try {
          if (etlEngine) {
            await etlEngine.stop();
          }
          await new Promise<void>((resolve, reject) => {
            server?.close((error) => error ? reject(error) : resolve());
          });
          if (connections) {
            await database.disconnectDatabases(connections);
          }
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
    if (etlEngine) {
      await etlEngine.stop().catch(() => undefined);
    }
    if (connections) {
      await database.disconnectDatabases(connections).catch(() => undefined);
    }
    logger.error(
      {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "HackMatrix API Server failed to start",
    );
    process.exitCode = 1;
  }
}

void startServer();
