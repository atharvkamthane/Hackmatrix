import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    MONGODB_URI: z.string().trim().min(1).optional(),
    MONGODB_CLINICAL_DB: z.string().trim().min(1).default("hackmatrix_clinical"),
    MONGODB_ANALYTICS_DB: z.string().trim().min(1).default("hackmatrix_analytics"),
    CORS_ORIGINS: z.string().trim().min(1).optional(),
    LOG_LEVEL: z.string().default("info"),
    BODY_LIMIT: z.string().default("1mb"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.MONGODB_URI) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MONGODB_URI"],
        message: "MONGODB_URI is required in production.",
      });
    }
    if (value.NODE_ENV === "production" && !value.CORS_ORIGINS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGINS"],
        message: "CORS_ORIGINS is required in production.",
      });
    }
  });

export type AppConfig = Omit<z.infer<typeof environmentSchema>, "CORS_ORIGINS"> & {
  CORS_ORIGINS: string;
  corsOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(env);
  const corsOriginsValue =
    parsed.CORS_ORIGINS ?? "http://localhost:8081,http://localhost:5173";
  return {
    ...parsed,
    CORS_ORIGINS: corsOriginsValue,
    corsOrigins: corsOriginsValue
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
