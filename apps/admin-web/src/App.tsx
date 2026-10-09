import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { TrendsPage } from './pages/TrendsPage';
import { RegionsPage } from './pages/RegionsPage';
import { ConditionsPage } from './pages/ConditionsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AuditPage } from './pages/AuditPage';
import { SecurityPage } from './pages/SecurityPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
};
