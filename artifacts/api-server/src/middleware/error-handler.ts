import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) return;

  const statusCode = error instanceof ZodError ? 400 : 500;
  const code = error instanceof ZodError ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
  const message =
    error instanceof ZodError
      ? "Request validation failed."
      : "An unexpected error occurred.";

  logger.error(
    {
      err: error,
      requestId: req.requestId,
      statusCode,
    },
    "Request failed",
  );

  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId: req.requestId,
      ...(error instanceof ZodError ? { issues: error.issues } : {}),
    },
  });
};
