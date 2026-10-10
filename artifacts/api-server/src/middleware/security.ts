import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { AppConfig } from "../config/env";

export function createSecurityMiddleware(config: AppConfig) {
  const allowedOrigins = new Set(config.corsOrigins);
  return {
    helmet: helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
        },
      },
    }),
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
      limit: config.NODE_ENV === "production" ? 300 : 10000,
      skip: (req) => config.NODE_ENV !== "production" && (req.headers.authorization === "Bearer dev_admin_token" || req.headers.authorization === "Bearer demo_token"),
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
      limit: config.NODE_ENV === "production" ? 30 : 10000,
      skip: (req) => config.NODE_ENV !== "production" && (req.headers.authorization === "Bearer dev_admin_token" || req.headers.authorization === "Bearer demo_token"),
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
