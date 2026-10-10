import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { SignIn } from '@clerk/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { TrendsPage } from './pages/TrendsPage';
import { RegionsPage } from './pages/RegionsPage';
import { ConditionsPage } from './pages/ConditionsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AuditPage } from './pages/AuditPage';
import { SecurityPage } from './pages/SecurityPage';

const AdminRoutes: React.FC = () => {
  const { user, isAuthenticated, isSignedIn, isLoading, error, logout, enterDemoMode, isDemo } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <section className="max-w-md w-full text-center space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="inline-flex h-9 w-9 animate-spin items-center justify-center rounded-full border-4 border-slate-200 border-t-cyan-600 mb-2" />
          <h2 className="text-base font-semibold text-slate-800">Checking administrator access...</h2>
          <p className="text-sm text-slate-500">Connecting to authentication service</p>
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={enterDemoMode}
              className="text-xs text-cyan-600 hover:text-cyan-700 font-medium underline"
            >
              Taking too long? Launch Instant Demo Mode
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <h1 className="text-xl font-bold text-slate-900 mb-1">HackMatrix Admin Console</h1>
            <p className="text-xs text-slate-500 mb-5">Epidemiological surveillance & privacy threshold monitoring</p>
            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:from-cyan-500 hover:to-blue-500 transition-all flex items-center justify-center gap-2 mb-4"
            >
              <span>⚡</span>
              <span>Launch Instant Demo Mode</span>
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs text-slate-400"><span className="bg-white px-2">or sign in with Clerk</span></div>
            </div>
            <div className="flex justify-center pt-2">
              <SignIn />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <section className="max-w-md w-full space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Administrator access required</h1>
          <p className="text-sm text-slate-600">{error || 'Your account is not authorized to view this dashboard.'}</p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => void logout()}
            >
              Sign out
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              onClick={enterDemoMode}
            >
              Enter Demo Mode
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <AppShell>
      {isDemo && (
        <aside aria-label="Demo mode indicator" className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <span className="font-medium">⚡ Running in Demo Mode (Local Synthetic Aggregates & Mock Telemetry)</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="underline font-semibold hover:text-amber-950"
          >
            Exit Demo
          </button>
        </aside>
      )}
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/trends" component={TrendsPage} />
        <Route path="/regions" component={RegionsPage} />
        <Route path="/conditions" component={ConditionsPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/audit" component={AuditPage} />
        <Route path="/security" component={SecurityPage} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </AppShell>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AdminRoutes />
  </AuthProvider>
);
