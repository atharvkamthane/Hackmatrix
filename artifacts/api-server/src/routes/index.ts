import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { createReadinessRouter } from "./readiness";
import type { DatabaseConnections } from "../db";

export function createApiRouter(
  connections: DatabaseConnections | undefined,
): IRouter {
  const router: IRouter = Router();

  router.use(healthRouter);
  router.use(createReadinessRouter(connections));

  return router;
}
