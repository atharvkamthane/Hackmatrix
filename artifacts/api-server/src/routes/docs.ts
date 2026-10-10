import { Router, type IRouter } from "express";

function authenticatedOperation(operationId: string, tag: string, summary: string, requestSchema?: string) {
  return {
    operationId,
    tags: [tag],
    summary,
    security: [{ bearerAuth: [] }],
    ...(requestSchema ? {
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: `#/components/schemas/${requestSchema}` } } },
      },
    } : {}),
    responses: {
      "200": { description: "Successful request", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiPayload" } } } },
      "201": { description: "Resource created", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiPayload" } } } },
      "400": { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      "401": { description: "Unauthenticated", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      "403": { description: "Role, organization, or consent denied", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      "404": { description: "Resource not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      "409": { description: "Request expired or no longer available", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
      "503": { description: "Database unavailable", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
    },
  };
}

const objectIdParameter = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
});

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
    { name: "patient", description: "Patient-owned clinical data and consent" },
    { name: "clinician", description: "Consent-controlled clinical workflows" },
    { name: "admin", description: "Privacy-protected analytics and audit summaries" },
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
    "/auth/provision-self": {
      post: authenticatedOperation("provisionSelf", "auth", "Self-provision authenticated identity as a test patient or clinician", "ProvisionSelfInput"),
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
    "/access/overview": {
      get: authenticatedOperation("getAccessOverview", "patient", "Get the caller's consent overview"),
    },
    "/patient/me": {
      get: authenticatedOperation("getPatientProfile", "patient", "Get the authenticated patient's profile"),
    },
    "/patient/records": {
      get: authenticatedOperation("getPatientRecords", "patient", "Get the authenticated patient's own records"),
    },
    "/patient/qr-token": {
      get: authenticatedOperation("createPatientQrToken", "patient", "Create a short-lived, opaque QR token"),
    },
    "/patient/access-requests": {
      get: authenticatedOperation("getPatientAccessRequests", "patient", "List access requests for the authenticated patient"),
    },
    "/patient/access-requests/{requestId}/decision": {
      post: {
        ...authenticatedOperation("decidePatientAccessRequest", "patient", "Approve or deny a pending access request", "AccessDecision"),
        parameters: [objectIdParameter("requestId")],
      },
    },
    "/patient/grants": {
      get: authenticatedOperation("getPatientAccessGrants", "patient", "List access grants for the authenticated patient"),
    },
    "/patient/grants/{grantId}/revoke": {
      post: {
        ...authenticatedOperation("revokePatientAccessGrant", "patient", "Revoke an active access grant"),
        parameters: [objectIdParameter("grantId")],
      },
    },
    "/clinician/qr/resolve": {
      post: authenticatedOperation("resolvePatientQrToken", "clinician", "Consume a patient QR token and create an access request", "QrResolve"),
    },
    "/clinician/access-requests/{requestId}": {
      get: {
        ...authenticatedOperation("getClinicianAccessRequest", "clinician", "Get a request created by the authenticated clinician"),
        parameters: [objectIdParameter("requestId")],
      },
    },
    "/clinician/patients": {
      get: authenticatedOperation("getAuthorizedPatient", "clinician", "Get a patient covered by an active grant"),
    },
    "/clinician/patients/{patientId}": {
      get: {
        ...authenticatedOperation("getAuthorizedPatientById", "clinician", "Get a specified patient covered by an active grant"),
        parameters: [objectIdParameter("patientId")],
      },
    },
    "/clinician/encounters": {
      post: authenticatedOperation("createEncounter", "clinician", "Create an encounter within an active visits grant", "EncounterInput"),
    },
    "/clinician/prescriptions": {
      post: authenticatedOperation("createPrescription", "clinician", "Create a prescription within an active prescription grant", "PrescriptionInput"),
    },
    "/clinician/observations": {
      post: authenticatedOperation("createObservation", "clinician", "Create an observation within an active labs grant", "ObservationInput"),
    },
    "/clinician/me": {
      get: authenticatedOperation("getClinicianProfile", "clinician", "Get the authenticated clinician's profile"),
    },
    "/clinician/conditions": {
      post: authenticatedOperation("createCondition", "clinician", "Record a condition diagnosis within an active visits grant", "ConditionInput"),
    },
    "/admin/provision-user": {
      post: authenticatedOperation("adminProvisionUser", "admin", "Admin-provision a new user account into an organization", "AdminProvisionInput"),
    },
    "/admin/summary": {
      get: authenticatedOperation("getAdminSummary", "admin", "Get K-suppressed aggregate system summary"),
    },
    "/admin/trends": {
      get: authenticatedOperation("getAdminTrends", "admin", "Query privacy-protected monthly disease trends"),
    },
    "/admin/regions": {
      get: authenticatedOperation("getAdminRegions", "admin", "Get privacy-protected regional aggregates"),
    },
    "/admin/conditions": {
      get: authenticatedOperation("getAdminConditions", "admin", "Get condition category aggregates"),
    },
    "/admin/privacy-config": {
      get: authenticatedOperation("getAdminPrivacyConfig", "admin", "Get privacy threshold configuration and aggregate metrics"),
    },
    "/admin/audit": {
      get: authenticatedOperation("getAdminAuditEvents", "admin", "Get paginated metadata-only audit events"),
    },
    "/admin/security-events": {
      get: authenticatedOperation("getAdminSecurityEvents", "admin", "Get safe security event summaries"),
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
          capabilities: { type: "array", items: { type: "string" }, example: ["clinical:read:self", "consent:manage:self"] },
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
      ApiPayload: {
        oneOf: [
          { type: "object", additionalProperties: true },
          { type: "array", items: { type: "object", additionalProperties: true } },
        ],
      },
      AccessDecision: {
        type: "object",
        properties: { decision: { type: "string", enum: ["approved", "denied"] } },
        required: ["decision"],
      },
      QrResolve: {
        type: "object",
        properties: {
          token: { type: "string", maxLength: 128 },
          scopes: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "string", enum: ["visits", "prescriptions", "labs"] } },
          durationMinutes: { type: "integer", minimum: 5, maximum: 240, default: 60 },
        },
        required: ["token"],
      },
      EncounterInput: {
        type: "object",
        properties: {
          patientId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
          diagnosis: { type: "string", maxLength: 200 },
          reason: { type: "string", maxLength: 500 },
          date: { type: "string", format: "date" },
        },
        required: ["patientId", "diagnosis", "reason", "date"],
      },
      PrescriptionInput: {
        type: "object",
        properties: {
          patientId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
          drug: { type: "string", maxLength: 200 },
          dose: { type: "string", maxLength: 120 },
          frequency: { type: "string", maxLength: 120 },
          start: { type: "string", format: "date" },
          end: { type: "string", format: "date" },
        },
        required: ["patientId", "drug", "dose", "frequency", "start", "end"],
      },
      ObservationInput: {
        type: "object",
        properties: {
          patientId: { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
          title: { type: "string", maxLength: 200 },
          value: { type: "string", maxLength: 200 },
          unit: { type: "string", maxLength: 80 },
          date: { type: "string", format: "date" },
        },
        required: ["patientId", "title", "value", "unit", "date"],
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
