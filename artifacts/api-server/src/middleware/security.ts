import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { AppConfig } from "../config/env";

export function createSecurityMiddleware(config: AppConfig) {
  const allowedOrigins = new Set(config.corsOrigins);
  return {
    helmet: helmet(),
    cors: cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed by CORS."));
      },
    }),
    apiRateLimit: rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        },
      },
    }),
    sensitiveRateLimit: rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many sensitive requests. Please try again later.",
        },
      },
    }),
  };
}
