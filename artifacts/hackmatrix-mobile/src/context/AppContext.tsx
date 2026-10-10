import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { services } from '@/src/services';
import { getAuthenticatedIdentity, type AuthenticatedIdentity } from '@/src/services/api';
import { getClerkInstance } from '@clerk/expo';
import type { Role } from '@/src/types/models';
import type { DemoAccessOverview } from '@/src/services/contracts';

const AUTH_MODE_KEY = 'hackmatrix.auth.mode.v2';

export type AuthMode = 'demo' | 'production';

export interface AppContextValue {
  authMode: AuthMode | null;
  isDemoMode: boolean;
  role: Role | null;
  userName: string | null;
  serverIdentity: AuthenticatedIdentity | null;
  isReady: boolean;
  data: DemoAccessOverview | null;
  error: string | null;
  signIn: (role: Role) => Promise<void>;
  signInDemo: (role: Role, customProfile?: { name: string; detail?: string }) => Promise<void>;
  signInProduction: () => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [serverIdentity, setServerIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [data, setData] = useState<DemoAccessOverview | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refresh = useCallback(async () => {
    if (authMode === 'demo') {
      try {
        const next = await services.patient.getDemoOverview();
        setData(next);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load the demo data.');
      }
    } else if (authMode === 'production') {
      try {
        const identity = await getAuthenticatedIdentity();
        setServerIdentity(identity);
        const resolvedRole: Role = identity.role === 'CLINICIAN' ? 'clinician' : 'patient';
        setRole(resolvedRole);
        setData(null);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to refresh production authorization.');
      }
    }
  }, [authMode]);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      try {
        const savedMode = await AsyncStorage.getItem(AUTH_MODE_KEY);
        if (savedMode === 'demo') {
          const [session, demoOverview] = await Promise.all([
            services.auth.getSession(),
            services.patient.getDemoOverview(),
          ]);
          if (!mounted) return;
          if (session?.role) {
            setAuthMode('demo');
            setRole(session.role);
            setUserName(session.name ?? null);
            setData(demoOverview);
          }
        } else if (savedMode === 'production') {
          try {
            const identity = await getAuthenticatedIdentity();
            if (!mounted) return;
            setAuthMode('production');
            setServerIdentity(identity);
            setRole(identity.role === 'CLINICIAN' ? 'clinician' : 'patient');
            setUserName(null);
            setData(null);
          } catch (prodErr) {
            if (!mounted) return;
            await AsyncStorage.removeItem(AUTH_MODE_KEY).catch(() => {});
            setAuthMode(null);
            setRole(null);
            setUserName(null);
            setServerIdentity(null);
            setData(null);
            setError(prodErr instanceof Error ? prodErr.message : 'Production session expired.');
          }
        }
      } catch (cause) {
        if (mounted) {
          setError(cause instanceof Error ? cause.message : 'Failed to initialize session.');
        }
      } finally {
        if (mounted) setIsReady(true);
      }
    }
    void restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  const signInDemo = useCallback(async (nextRole: Role, customProfile?: { name: string; detail?: string }) => {
    try {
      await AsyncStorage.setItem(AUTH_MODE_KEY, 'demo');
      const session = await services.auth.signIn(nextRole, customProfile);
      setAuthMode('demo');
      setRole(session.role);
      setUserName(session.name ?? null);
      setServerIdentity(null);
      setError(null);
      const demoOverview = await services.patient.getDemoOverview();
      setData(demoOverview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start demo session.');
      throw cause;
    }
  }, []);

  const signIn = signInDemo;

  const signInProduction = useCallback(async () => {
    try {
      setError(null);
      const identity = await getAuthenticatedIdentity();
      await AsyncStorage.setItem(AUTH_MODE_KEY, 'production');
      setAuthMode('production');
      setServerIdentity(identity);
      const appRole: Role = identity.role === 'CLINICIAN' ? 'clinician' : 'patient';
      setRole(appRole);
      setUserName(null);
      setData(null);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Production sign-in failed.';
      await AsyncStorage.removeItem(AUTH_MODE_KEY).catch(() => {});
      setAuthMode(null);
      setRole(null);
      setUserName(null);
      setServerIdentity(null);
      setData(null);
      setError(msg);
      throw cause;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(AUTH_MODE_KEY);
      await services.auth.signOut().catch(() => {});
      try {
        const clerk = getClerkInstance();
        if (clerk?.signOut) {
          await clerk.signOut();
        }
      } catch {
        // Ignore Clerk sign-out failure on unmounted or offline instances
      }
    } finally {
      setAuthMode(null);
      setRole(null);
      setUserName(null);
      setServerIdentity(null);
      setData(null);
      setError(null);
    }
  }, []);

  const switchDemoRole = useCallback(async () => {
    if (authMode !== 'demo') {
      throw new Error('Role switching is disabled in production mode. Identity is server-controlled.');
    }
    const nextRole: Role = role === 'patient' ? 'clinician' : 'patient';
    const session = await services.auth.signIn(nextRole);
    setRole(session.role);
    setUserName(session.name ?? null);
    const demoOverview = await services.patient.getDemoOverview();
    setData(demoOverview);
  }, [authMode, role]);

  const value = useMemo(
    () => ({
      authMode,
      isDemoMode: authMode === 'demo',
      role,
      userName,
      serverIdentity,
      isReady,
      data,
      error,
      signIn,
      signInDemo,
      signInProduction,
      signOut,
      switchDemoRole,
      refresh,
      clearError,
    }),
    [authMode, clearError, data, error, isReady, refresh, role, userName, serverIdentity, signIn, signInDemo, signInProduction, signOut, switchDemoRole],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used inside AppProvider.');
  return value;
}