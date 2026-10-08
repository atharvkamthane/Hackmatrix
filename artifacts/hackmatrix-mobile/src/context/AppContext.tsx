import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth, useClerk } from '@clerk/expo';
import { services } from '@/src/services';
import { getAuthenticatedIdentity, type AuthenticatedIdentity } from '@/src/services/api';
import type { Role } from '@/src/types/models';
import type { DemoAccessOverview } from '@/src/services/contracts';

interface AppContextValue {
  role: Role | null;
  isReady: boolean;
  identity: AuthenticatedIdentity | null;
  data: DemoAccessOverview | null;
  error: string | null;
  signIn: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [role, setRole] = useState<Role | null>(null);
  const [identity, setIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [data, setData] = useState<DemoAccessOverview | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await services.patient.getDemoOverview();
      setData(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the demo data.');
    }
  }, []);

  // Initialize demo session state on load
  useEffect(() => {
    let mounted = true;
    services.auth.getSession().then(async (session) => {
      if (!mounted) return;
      if (session?.role) {
        setRole(session.role);
        const demoOverview = await services.patient.getDemoOverview().catch(() => null);
        if (mounted && demoOverview) setData(demoOverview);
      }
      if (mounted) setIsReady(true);
    }).catch(() => {
      if (mounted) setIsReady(true);
    });
    return () => { mounted = false; };
  }, []);

  // Handle Clerk authentication if signed in
  useEffect(() => {
    let mounted = true;
    if (!isLoaded || !isSignedIn) return;

    getAuthenticatedIdentity()
      .then(async (serverIdentity) => {
        if (!mounted) return;
        if (serverIdentity.role === 'ADMIN') {
          throw new Error('Admin accounts must use the web administration experience.');
        }
        const resolvedRole: Role = serverIdentity.role === 'PATIENT' ? 'patient' : 'clinician';
        await services.auth.signIn(resolvedRole);
        const demoOverview = await services.patient.getDemoOverview().catch(() => null);
        if (!mounted) return;
        setRole(resolvedRole);
        setIdentity(serverIdentity);
        if (demoOverview) setData(demoOverview);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (mounted) {
          setError(
            cause instanceof Error && cause.message.includes('role')
              ? 'Signed in with Clerk, but no server role (PATIENT/CLINICIAN) is assigned in your Clerk metadata yet. You can choose a demo role below to explore.'
              : cause instanceof Error ? cause.message : 'Unable to verify server authorization.'
          );
        }
      });

    return () => { mounted = false; };
  }, [isLoaded, isSignedIn]);

  const signIn = useCallback(async (nextRole: Role) => {
    const session = await services.auth.signIn(nextRole);
    const demoOverview = await services.patient.getDemoOverview().catch(() => null);
    setRole(session.role);
    if (demoOverview) setData(demoOverview);
    setError(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (isSignedIn) await clerk.signOut();
    } catch {}
    await services.auth.signOut();
    setRole(null);
    setIdentity(null);
    setData(null);
    setError(null);
  }, [clerk, isSignedIn]);

  const switchDemoRole = useCallback(async () => {
    const nextRole: Role = role === 'patient' ? 'clinician' : 'patient';
    const session = await services.auth.signIn(nextRole);
    setRole(session.role);
    await refresh();
  }, [refresh, role]);

  const value = useMemo(
    () => ({ role, identity, isReady, data, error, signIn, signOut, switchDemoRole, refresh }),
    [data, error, identity, isReady, refresh, role, signIn, signOut, switchDemoRole],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used inside AppProvider.');
  return value;
}
