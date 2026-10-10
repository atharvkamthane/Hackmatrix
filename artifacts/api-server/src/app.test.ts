import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createApp } from "./app";
import { loadConfig, type AppConfig } from "./config/env";
import type { DatabaseConnections } from "./db";
import type { VerifiedClerkIdentity, InternalUserRecord } from "./auth";

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...loadConfig({
      NODE_ENV: "test",
      CORS_ORIGINS: "http://allowed.test",
    }),
    ...overrides,
  };
}

async function request(
  app: ReturnType<typeof createApp>,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: address.port,
        path,
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => {
          server.close();
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
        });
      },
    );
    req.on("error", (error) => {
      server.close();
      reject(error);
    });
    req.end();
  });
}

function authApp(identity: VerifiedClerkIdentity | null) {
  return createApp({
    config: testConfig(),
    verifyClerkRequest: async () => identity,
  });
}

function internalAuthApp(
  identity: VerifiedClerkIdentity | null,
  internalUser: InternalUserRecord | null,
) {
  return createApp({
    config: testConfig(),
    verifyClerkRequest: async () => identity,
    findInternalUser: async () => internalUser,
  });
}

test("health endpoint confirms process liveness", async () => {
  const response = await request(createApp({ config: testConfig() }), "/api/healthz");
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: "ok" });
  assert.match(String(response.headers["x-request-id"]), /^[0-9a-f-]{36}$/);
});

test("readiness endpoint reports unavailable dependencies", async () => {
  const response = await request(createApp({ config: testConfig() }), "/api/readyz");
  assert.equal(response.status, 503);
  assert.deepEqual(JSON.parse(response.body), { status: "not_ready" });
});

test("readiness endpoint reports ready dependencies", async () => {
  const connections = {
    clinical: { readyState: 1 },
    analytics: { readyState: 1 },
  } as DatabaseConnections;
  const response = await request(
    createApp({ config: testConfig(), connections }),
    "/api/readyz",
  );
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: "ready" });
});

test("production configuration requires MongoDB", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", CORS_ORIGINS: "https://admin.example.com" }),
    /MONGODB_URI is required in production/,
  );
});

test("security middleware sets headers and allows configured CORS origins", async () => {
  const response = await request(createApp({ config: testConfig() }), "/api/healthz", {
    Origin: "http://allowed.test",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], "http://allowed.test");
  assert.ok(response.headers["content-security-policy"]);
});

test("disallowed CORS requests return the centralized error shape", async () => {
  const response = await request(createApp({ config: testConfig() }), "/api/healthz", {
    Origin: "http://blocked.test",
  });
  assert.equal(response.status, 500);
  const body = JSON.parse(response.body);
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.match(body.error.requestId, /^[0-9a-f-]{36}$/);
  assert.equal(body.error.message, "An unexpected error occurred.");
});

test("unauthenticated requests return 401", async () => {
  const response = await request(authApp(null), "/api/auth/me");
  assert.equal(response.status, 401);
  assert.equal(JSON.parse(response.body).error.code, "UNAUTHENTICATED");
});

test("patient cannot access clinician endpoint", async () => {
  const response = await request(
    authApp({ userId: "user_patient", roleClaim: "PATIENT", organizationId: "org_1" }),
    "/api/auth/test/clinician",
  );
  assert.equal(response.status, 403);
});

test("clinician cannot access admin endpoint", async () => {
  const response = await request(
    authApp({ userId: "user_clinician", roleClaim: "CLINICIAN", organizationId: "org_1" }),
    "/api/auth/test/admin",
  );
  assert.equal(response.status, 403);
});

test("admin cannot access patient endpoint", async () => {
  const response = await request(
    authApp({ userId: "user_admin", roleClaim: "ADMIN", organizationId: "org_1" }),
    "/api/auth/test/patient",
  );
  assert.equal(response.status, 403);
});

test("client supplied role cannot elevate verified identity", async () => {
  const response = await request(
    authApp({ userId: "user_patient", roleClaim: "PATIENT", organizationId: "org_1" }),
    "/api/auth/test/admin?role=ADMIN",
  );
  assert.equal(response.status, 403);
});

test("organization mismatch is rejected", async () => {
  const response = await request(
    authApp({ userId: "user_clinician", roleClaim: "CLINICIAN", organizationId: "org_1" }),
    "/api/auth/test/organization/org_2",
  );
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error.code, "ORGANIZATION_FORBIDDEN");
});

test("missing server role is rejected instead of defaulted", async () => {
  const response = await request(
    authApp({ userId: "user_unknown", roleClaim: undefined, organizationId: null }),
    "/api/auth/me",
  );
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error.code, "ROLE_NOT_ASSIGNED");
});

test("verified identity maps to internal user record with server-controlled role", async () => {
  const response = await request(
    internalAuthApp(
      { userId: "clerk_123", roleClaim: null, organizationId: null },
      { clerkUserId: "clerk_123", role: "PATIENT", organizationId: "org_internal_1", status: "active" },
    ),
    "/api/auth/me",
  );
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.userId, "clerk_123");
  assert.equal(body.role, "PATIENT");
  assert.equal(body.organizationId, "org_internal_1");
});

test("unassigned identity without internal user mapping returns 403 USER_NOT_PROVISIONED", async () => {
  const response = await request(
    internalAuthApp(
      { userId: "clerk_unmapped", roleClaim: null, organizationId: null },
      null,
    ),
    "/api/auth/me",
  );
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error.code, "USER_NOT_PROVISIONED");
});

test("disabled internal account is rejected with 403 ACCOUNT_DISABLED", async () => {
  const response = await request(
    internalAuthApp(
      { userId: "clerk_disabled", roleClaim: null, organizationId: null },
      { clerkUserId: "clerk_disabled", role: "CLINICIAN", organizationId: "org_1", status: "disabled" },
    ),
    "/api/auth/me",
  );
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error.code, "ACCOUNT_DISABLED");
});

test("client role and organization spoofing via body/query/headers cannot override internal mapping", async () => {
  const response = await request(
    internalAuthApp(
      { userId: "clerk_spoof", roleClaim: null, organizationId: null },
      { clerkUserId: "clerk_spoof", role: "PATIENT", organizationId: "org_trusted", status: "active" },
    ),
    "/api/auth/test/admin?role=ADMIN&organizationId=org_admin",
    {
      "X-User-Role": "ADMIN",
      "X-Organization-Id": "org_admin",
    },
  );
  assert.equal(response.status, 403);
});

test("development landing page renders cleanly at GET /", async () => {
  const response = await request(createApp({ config: testConfig() }), "/");
  assert.equal(response.status, 200);
  assert.ok(response.body.includes("HackMatrix API"));
  assert.ok(response.body.includes("/api/healthz"));
  assert.ok(response.body.includes("/docs"));
});

test("Swagger UI documentation renders at GET /docs and spec at /docs/openapi.json", async () => {
  const app = createApp({ config: testConfig() });
  const docsHtml = await request(app, "/docs");
  assert.equal(docsHtml.status, 200);
  assert.ok(docsHtml.body.includes("SwaggerUIBundle"));

  const specJson = await request(app, "/docs/openapi.json");
  assert.equal(specJson.status, 200);
  const parsed = JSON.parse(specJson.body);
  assert.equal(parsed.openapi, "3.1.0");
  assert.ok(parsed.paths["/healthz"]);
  assert.ok(parsed.paths["/readyz"]);
  assert.ok(parsed.paths["/auth/me"]);
});

