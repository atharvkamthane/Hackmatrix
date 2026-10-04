import type { RequestHandler } from "express";
import { z } from "zod";

export function validateQuery<T extends z.ZodTypeAny>(
  schema: T,
): RequestHandler {
  return (req, _res, next) => {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
  };
}

export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(
  schema: T,
): RequestHandler {
  return (req, _res, next) => {
    req.params = schema.parse(req.params);
    next();
  };
}
