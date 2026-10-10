import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { SignIn } from '@clerk/react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { TrendsPage } from './pages/TrendsPage';
import { RegionsPage } from './pages/RegionsPage';
import { ConditionsPage } from './pages/ConditionsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AuditPage } from './pages/AuditPage';
import { SecurityPage } from './pages/SecurityPage';

const AdminRoutes: React.FC = () => {
  const { user, isAuthenticated, isSignedIn, isLoading, error, logout } = useAuth();

  if (isLoading) {
    return <main className="min-h-screen grid place-items-center text-sm text-slate-600">Checking administrator access...</main>;
  }

  if (!isSignedIn) {
    return <main className="min-h-screen grid place-items-center bg-slate-50 p-6"><SignIn /></main>;
  }

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <section className="max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Administrator access required</h1>
          <p className="text-sm text-slate-600">{error || 'Your account is not authorized to view this dashboard.'}</p>
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={() => void logout()}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <AppShell>
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
