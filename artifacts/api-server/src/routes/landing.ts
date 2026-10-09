import { Router, type IRouter } from "express";
import type { AppConfig } from "../config/env";
import { areDatabasesReady, type DatabaseConnections } from "../db";

export function createLandingRouter(
  config: AppConfig,
  connections: DatabaseConnections | undefined,
): IRouter {
  const router: IRouter = Router();

  router.get("/", (_req, res) => {
    const isDbReady = areDatabasesReady(connections);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HackMatrix API — Development Console</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151d30;
      --border: #23304d;
      --primary: #38bdf8;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --success: #10b981;
      --warning: #f59e0b;
      --error: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.5;
      padding: 32px 16px;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      background: #1e293b;
      color: var(--primary);
      border: 1px solid var(--border);
    }
    .badge-success { background: #064e3b; color: #6ee7b7; border-color: #047857; }
    .badge-warning { background: #78350f; color: #fde68a; border-color: #b45309; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 1.15rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      display: inline-block;
    }
    .dot-warn { background: var(--warning); }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 24px 0 12px;
      color: var(--primary);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
    }
    th {
      background: #192238;
      color: var(--muted);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
    }
    tr:last-child td { border-bottom: none; }
    a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }
    a:hover { text-decoration: underline; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--primary);
      color: #0b0f19;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      margin-top: 12px;
    }
    .btn:hover { background: #7dd3fc; text-decoration: none; }
    .notice {
      margin-top: 24px;
      padding: 12px 16px;
      border-radius: 6px;
      background: #182236;
      border-left: 3px solid var(--primary);
      font-size: 0.85rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="title">🏥 HackMatrix API</div>
        <div style="font-size: 0.875rem; color: var(--muted); margin-top: 4px;">Consent-First Healthcare Records Platform</div>
      </div>
      <div>
        <span class="badge">v0.1.0</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="card-title">Environment</div>
        <div class="card-value">${config.NODE_ENV}</div>
      </div>
      <div class="card">
        <div class="card-title">Server Port</div>
        <div class="card-value">${config.PORT}</div>
      </div>
      <div class="card">
        <div class="card-title">Database Status</div>
        <div class="card-value">
          <span class="dot ${isDbReady ? "" : "dot-warn"}"></span>
          ${isDbReady ? "Connected (Ready)" : "Connecting / Unavailable"}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Authentication</div>
        <div class="card-value">
          <span class="dot ${config.CLERK_SECRET_KEY ? "" : "dot-warn"}"></span>
          ${config.CLERK_SECRET_KEY ? "Clerk Verified" : "Mock / Local"}
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 12px; align-items: center;">
      <a href="/docs" class="btn">📖 Open Swagger UI Documentation</a>
      <a href="/docs/openapi.json" style="font-size: 0.875rem; color: var(--muted);">OpenAPI Spec (JSON)</a>
    </div>

    <div class="section-title">Available Local Endpoints</div>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Endpoint</th>
          <th>Description</th>
          <th>Auth Required</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-success">GET</span></td>
          <td><a href="/api/healthz" target="_blank">/api/healthz</a></td>
          <td>Process liveness probe</td>
          <td>No</td>
        </tr>
        <tr>
          <td><span class="badge badge-success">GET</span></td>
          <td><a href="/api/readyz" target="_blank">/api/readyz</a></td>
          <td>Database readiness probe (Clinical + Analytics)</td>
          <td>No</td>
        </tr>
        <tr>
          <td><span class="badge badge-success">GET</span></td>
          <td><a href="/api/auth/me" target="_blank">/api/auth/me</a></td>
          <td>Current authenticated user context & server-verified role</td>
          <td>Yes (Bearer token)</td>
        </tr>
        <tr>
          <td><span class="badge badge-success">GET</span></td>
          <td><a href="/api/auth/test/patient" target="_blank">/api/auth/test/patient</a></td>
          <td>Test route: requires PATIENT role</td>
          <td>Yes (PATIENT)</td>
        </tr>
        <tr>
          <td><span class="badge badge-success">GET</span></td>
          <td><a href="/api/auth/test/clinician" target="_blank">/api/auth/test/clinician</a></td>
          <td>Test route: requires CLINICIAN role</td>
          <td>Yes (CLINICIAN)</td>
        </tr>
        <tr>
          <td><span class="badge badge-success">GET</span></td>
          <td><a href="/api/auth/test/admin" target="_blank">/api/auth/test/admin</a></td>
          <td>Test route: requires ADMIN role</td>
          <td>Yes (ADMIN)</td>
        </tr>
      </tbody>
    </table>

    <div class="notice">
      🔒 <strong>Security Note:</strong> Client-provided roles in query parameters, headers, and request bodies are strictly rejected. All roles are resolved server-side from authenticated token metadata.
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  return router;
}
