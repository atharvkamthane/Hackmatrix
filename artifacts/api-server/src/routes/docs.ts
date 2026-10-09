import { Router, type IRouter } from "express";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "HackMatrix API",
    version: "0.1.0",
    description: "Consent-first healthcare records and clinical exchange platform.",
  },
  servers: [{ url: "/api", description: "Base API path" }],
  tags: [
    { name: "system", description: "System health and readiness" },
    { name: "auth", description: "Authentication and server-controlled role verification" },
  ],
  paths: {
    "/healthz": {
      get: {
        operationId: "healthCheck",
        tags: ["system"],
        summary: "Health check",
        description: "Returns server process liveness status.",
        responses: {
          "200": {
            description: "Process is live",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthStatus" },
              },
            },
          },
        },
      },
    },
    "/readyz": {
      get: {
        operationId: "readinessCheck",
        tags: ["system"],
        summary: "Readiness check",
        description: "Returns database connection readiness status (checks both clinical and analytics connections).",
        responses: {
          "200": {
            description: "Databases are ready",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadinessStatus" },
              },
            },
          },
          "503": {
            description: "Databases unavailable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadinessStatus" },
              },
            },
          },
        },
      },
    },
    "/auth/me": {
      get: {
        operationId: "getAuthenticatedUser",
        tags: ["auth"],
        summary: "Get authenticated user context",
        description: "Returns verified user identity, role, and organization derived from Clerk session. Role is server-controlled and cannot be spoofed by client.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Authenticated user context",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthMeResponse" },
              },
            },
          },
          "401": {
            description: "Unauthenticated - missing or invalid token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Role not assigned or server resolution failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/test/patient": {
      get: {
        operationId: "testPatientRole",
        tags: ["auth"],
        summary: "Verify patient role access",
        description: "Protected route requiring PATIENT role. Rejects other roles with 403.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Access permitted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleTestResponse" },
              },
            },
          },
          "401": {
            description: "Unauthenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden - role mismatch",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/test/clinician": {
      get: {
        operationId: "testClinicianRole",
        tags: ["auth"],
        summary: "Verify clinician role access",
        description: "Protected route requiring CLINICIAN role. Rejects other roles with 403.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Access permitted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleTestResponse" },
              },
            },
          },
          "401": {
            description: "Unauthenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden - role mismatch",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/test/admin": {
      get: {
        operationId: "testAdminRole",
        tags: ["auth"],
        summary: "Verify admin role access",
        description: "Protected route requiring ADMIN role. Rejects other roles with 403.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Access permitted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RoleTestResponse" },
              },
            },
          },
          "401": {
            description: "Unauthenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden - role mismatch",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/auth/test/organization/{organizationId}": {
      get: {
        operationId: "testOrganizationMatch",
        tags: ["auth"],
        summary: "Verify organization match",
        description: "Protected route requiring matching organization membership.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "organizationId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Target organization ID to match against user's organization",
          },
        ],
        responses: {
          "200": {
            description: "Organization matched",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatusResponse" },
              },
            },
          },
          "401": {
            description: "Unauthenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "Forbidden - organization mismatch",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Pass verified Clerk session or Bearer JWT token in Authorization header.",
      },
    },
    schemas: {
      HealthStatus: {
        type: "object",
        properties: { status: { type: "string", example: "ok" } },
        required: ["status"],
      },
      ReadinessStatus: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["ready", "not_ready"], example: "ready" },
        },
        required: ["status"],
      },
      AuthMeResponse: {
        type: "object",
        properties: {
          userId: { type: "string", example: "user_2sA19x..." },
          role: { type: "string", enum: ["PATIENT", "CLINICIAN", "ADMIN"], example: "PATIENT" },
          organizationId: { type: "string", nullable: true, example: "org_2sB84k..." },
        },
        required: ["userId", "role"],
      },
      RoleTestResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          role: { type: "string", enum: ["PATIENT", "CLINICIAN", "ADMIN"] },
        },
        required: ["status", "role"],
      },
      StatusResponse: {
        type: "object",
        properties: { status: { type: "string", example: "ok" } },
        required: ["status"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "UNAUTHENTICATED" },
              message: { type: "string", example: "Authentication is required." },
              requestId: { type: "string", example: "f86a9d63-701a-4558-8f2b-74125d1f9ecd" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
};

export function createDocsRouter(): IRouter {
  const router: IRouter = Router();

  router.get("/docs/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  router.get("/docs", (_req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HackMatrix API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .top-bar { background: #1e293b; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; }
    .top-bar h1 { margin: 0; font-size: 1.1rem; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .top-bar a { color: #94a3b8; text-decoration: none; font-size: 0.875rem; }
    .top-bar a:hover { color: #f8fafc; }
    .swagger-ui { background: #ffffff; padding: 20px; border-radius: 8px; max-width: 1200px; margin: 24px auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
  </style>
</head>
<body>
  <div class="top-bar">
    <h1><span>🏥</span> HackMatrix API Documentation</h1>
    <div>
      <a href="/">← Back to Landing Page</a> &nbsp;|&nbsp;
      <a href="/docs/openapi.json" target="_blank">OpenAPI JSON</a>
    </div>
  </div>
  <div id="swagger-ui" class="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(openApiSpec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  return router;
}
