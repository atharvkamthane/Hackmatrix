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
  signOut: () => Promise<void>;
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

  useEffect(() => {
    let mounted = true;
    if (!isLoaded) return () => { mounted = false; };
    if (!isSignedIn) {
      setRole(null);
      setIdentity(null);
      setData(null);
      setIsReady(true);
      return () => { mounted = false; };
    }

    setIsReady(false);
    Promise.all([getAuthenticatedIdentity(), services.patient.getDemoOverview()])
      .then(async ([serverIdentity, demoOverview]) => {
        if (!mounted) return;
        if (serverIdentity.role === 'ADMIN') {
          throw new Error('Admin accounts must use the web administration experience.');
        }
        const resolvedRole: Role = serverIdentity.role === 'PATIENT' ? 'patient' : 'clinician';
        // The mock dataset remains only for UI development. Its role is derived
        // from the verified server response, never selected by the client.
        await services.auth.signIn(resolvedRole);
        if (!mounted) return;
        setRole(resolvedRole);
        setIdentity(serverIdentity);
        setData(demoOverview);
      })
      .catch((cause: unknown) => {
        if (mounted) {
          setError(cause instanceof Error ? cause.message : 'Unable to load the demo.');
        }
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [isLoaded, isSignedIn]);

  const signOut = useCallback(async () => {
    await Promise.all([clerk.signOut(), services.auth.signOut()]);
    setRole(null);
    setIdentity(null);
    setData(null);
  }, [clerk]);

  const value = useMemo(
    () => ({ role, identity, isReady, data, error, signOut, refresh }),
    [data, error, identity, isReady, refresh, role, signOut],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used inside AppProvider.');
  return value;
}
