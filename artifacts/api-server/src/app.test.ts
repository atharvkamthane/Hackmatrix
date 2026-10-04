import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createApp } from "./app";
import { loadConfig, type AppConfig } from "./config/env";
import type { DatabaseConnections } from "./db";

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
