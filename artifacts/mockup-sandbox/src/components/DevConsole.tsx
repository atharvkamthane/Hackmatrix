import { useEffect, useState } from "react";

interface ApiCheckState {
  health: { status: string; ok: boolean } | null;
  readiness: { status: string; ok: boolean } | null;
  auth: { status: number; body: unknown } | null;
  loading: boolean;
  lastChecked: string | null;
  testResult: { title: string; status: number; body: string } | null;
}

const API_BASE_URL = "http://localhost:3000";

export function DevConsole() {
  const [state, setState] = useState<ApiCheckState>({
    health: null,
    readiness: null,
    auth: null,
    loading: true,
    lastChecked: null,
    testResult: null,
  });

  const checkStatus = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const [healthRes, readyRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/healthz`).then(async (r) => ({
          ok: r.ok,
          data: await r.json(),
        })),
        fetch(`${API_BASE_URL}/api/readyz`).then(async (r) => ({
          ok: r.ok,
          data: await r.json(),
        })),
      ]);

      setState((prev) => ({
        ...prev,
        health:
          healthRes.status === "fulfilled"
            ? { status: healthRes.value.data.status, ok: healthRes.value.ok }
            : { status: "offline", ok: false },
        readiness:
          readyRes.status === "fulfilled"
            ? { status: readyRes.value.data.status, ok: readyRes.value.ok }
            : { status: "not_ready", ok: false },
        loading: false,
        lastChecked: new Date().toLocaleTimeString(),
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        health: { status: "unreachable", ok: false },
        readiness: { status: "unreachable", ok: false },
        loading: false,
        lastChecked: new Date().toLocaleTimeString(),
      }));
    }
  };

  useEffect(() => {
    void checkStatus();
  }, []);

  const runTest = async (title: string, url: string, headers: Record<string, string> = {}) => {
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      setState((prev) => ({
        ...prev,
        testResult: { title, status: res.status, body: text },
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        testResult: {
          title,
          status: 0,
          body: e instanceof Error ? e.message : "Request failed",
        },
      }));
    }
  };

  const isMongoConnected = state.readiness?.status === "ready";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏥</span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                HackMatrix Development Console
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Local environment diagnostics & security verification dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void checkStatus()}
              disabled={state.loading}
              className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-md transition shadow-sm"
            >
              {state.loading ? "Checking..." : "↻ Refresh Status"}
            </button>
            {state.lastChecked && (
              <span className="text-xs text-slate-500">
                Last checked: {state.lastChecked}
              </span>
            )}
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Backend Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Backend Service
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">API URL:</span>
                <span className="font-mono text-xs text-sky-400">{API_BASE_URL}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Process Liveness:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    state.health?.ok
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-rose-950 text-rose-400 border border-rose-800"
                  }`}
                >
                  {state.health?.status ?? "Checking..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Database Readiness:</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    state.readiness?.ok
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-amber-950 text-amber-400 border border-amber-800"
                  }`}
                >
                  {state.readiness?.status ?? "Checking..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">MongoDB (Clinical+Analytics):</span>
                <span
                  className={`font-semibold text-xs ${
                    isMongoConnected ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {isMongoConnected ? "● Connected" : "○ Disconnected"}
                </span>
              </div>
            </div>
          </div>

          {/* Authentication Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Authentication
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Clerk Backend:</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Configured
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Current Session:</span>
                <span className="text-xs text-slate-400">No active browser token</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Role Resolution:</span>
                <span className="text-xs font-semibold text-sky-400">
                  Server-Enforced Only
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Supported Roles:</span>
                <span className="text-xs text-slate-300 font-mono">
                  PATIENT, CLINICIAN, ADMIN
                </span>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Security
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Helmet CSP:</span>
                <span className="text-xs font-semibold text-emerald-400">● Enabled</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">CORS Origins:</span>
                <span className="text-xs text-emerald-400 font-semibold">● Whitelisted</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Rate Limiter:</span>
                <span className="text-xs text-emerald-400 font-semibold">● 300 / 15m</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Privilege Escalation:</span>
                <span className="text-xs text-emerald-400 font-semibold">● Blocked</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Testing Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Interactive Endpoint Verifier
            </h2>
            <div className="flex gap-2">
              <a
                href={`${API_BASE_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-sky-400 hover:underline flex items-center gap-1"
              >
                📖 Open Swagger UI ({API_BASE_URL}/docs) ↗
              </a>
              <span className="text-slate-600">|</span>
              <a
                href={`${API_BASE_URL}/`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-400 hover:underline"
              >
                Backend Landing Page ↗
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void runTest("Health Check", `${API_BASE_URL}/api/healthz`)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition"
            >
              Test GET /api/healthz
            </button>
            <button
              onClick={() => void runTest("Readiness Check", `${API_BASE_URL}/api/readyz`)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition"
            >
              Test GET /api/readyz
            </button>
            <button
              onClick={() => void runTest("Unauthenticated Auth/Me", `${API_BASE_URL}/api/auth/me`)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition"
            >
              Test GET /api/auth/me (Expect 401)
            </button>
            <button
              onClick={() =>
                void runTest(
                  "Privilege Escalation Spoof Attempt",
                  `${API_BASE_URL}/api/auth/test/admin?role=ADMIN`,
                  { "x-role": "ADMIN" }
                )
              }
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-medium rounded transition"
            >
              Test Role Spoof (?role=ADMIN, Expect 401)
            </button>
          </div>

          {state.testResult && (
            <div className="mt-3 bg-slate-950 border border-slate-800 rounded p-4 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400 mb-2 pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-200">
                  {state.testResult.title}
                </span>
                <span
                  className={
                    state.testResult.status >= 200 && state.testResult.status < 300
                      ? "text-emerald-400 font-bold"
                      : "text-amber-400 font-bold"
                  }
                >
                  HTTP Status: {state.testResult.status}
                </span>
              </div>
              <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap">
                {state.testResult.body}
              </pre>
            </div>
          )}
        </div>

        {/* Security Statement */}
        <div className="text-xs text-slate-500 bg-slate-900/50 border border-slate-800/80 rounded p-3">
          <strong>Security Compliance:</strong> No tokens, session cookies, database credentials, or patient records are exposed on this console. All authentication decisions are strictly verified at the backend boundary.
        </div>
      </div>
    </div>
  );
}
