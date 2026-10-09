import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  req.requestId = requestId;
  next();
};
