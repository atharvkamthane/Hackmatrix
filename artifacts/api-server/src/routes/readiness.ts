import { Router, type IRouter } from "express";
import { areDatabasesReady, type DatabaseConnections } from "../db";

export function createReadinessRouter(
  connections: DatabaseConnections | undefined,
): IRouter {
  const router: IRouter = Router();

  router.get("/readyz", (_req, res) => {
    if (!areDatabasesReady(connections)) {
      res.status(503).json({ status: "not_ready" });
      return;
    }
    res.json({ status: "ready" });
  });

  return router;
}
