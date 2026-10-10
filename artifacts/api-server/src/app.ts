import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { loadConfig, type AppConfig } from "./config/env";
import { type DatabaseConnections } from "./db";
import { createClerkVerifier, type VerifyClerkRequest, type FindInternalUser } from "./auth";
import { errorHandler } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { createSecurityMiddleware } from "./middleware/security";
import { createApiRouter } from "./routes";
import { createLandingRouter } from "./routes/landing";
import { createDocsRouter } from "./routes/docs";
import { logger } from "./lib/logger";

export interface AppDependencies {
  config?: AppConfig;
  connections?: DatabaseConnections;
  verifyClerkRequest?: VerifyClerkRequest;
  findInternalUser?: FindInternalUser;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const config = dependencies.config ?? loadConfig();
  const verifyClerkRequest =
    dependencies.verifyClerkRequest ??
    (config.CLERK_SECRET_KEY
      ? createClerkVerifier(config)
      : async () => null);
  const security = createSecurityMiddleware(config);
  const app: Express = express();

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            requestId: (req as typeof req & { requestId?: string }).requestId,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(security.helmet);
  app.use(security.cors);
  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));
  app.use(createLandingRouter(config, dependencies.connections));
  app.use(createDocsRouter());
  app.use("/api", security.apiRateLimit);
  app.use("/api/auth", security.sensitiveRateLimit);
  app.use("/api/qr", security.sensitiveRateLimit);
  app.use("/api/clinician/qr", security.sensitiveRateLimit);
  app.use(
    "/api",
    createApiRouter(
      dependencies.connections,
      verifyClerkRequest,
      dependencies.findInternalUser,
    ),
  );
  app.use(errorHandler);

  return app;
}

const defaultApp: Express = createApp();
export default defaultApp;

