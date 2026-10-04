import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { services } from '@/src/services';
import type { Role } from '@/src/types/models';
import type { DemoAccessOverview } from '@/src/services/contracts';

interface AppContextValue {
  role: Role | null;
  isReady: boolean;
  data: DemoAccessOverview | null;
  error: string | null;
  signIn: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
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
    Promise.all([services.auth.getSession(), services.patient.getDemoOverview()])
      .then(([session, demoOverview]) => {
        if (!mounted) return;
        setRole(session?.role ?? null);
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
  }, []);

  const signIn = useCallback(async (nextRole: Role) => {
    const session = await services.auth.signIn(nextRole);
    setRole(session.role);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await services.auth.signOut();
    setRole(null);
  }, []);

  const switchDemoRole = useCallback(async () => {
    const nextRole: Role = role === 'patient' ? 'clinician' : 'patient';
    const session = await services.auth.signIn(nextRole);
    setRole(session.role);
    await refresh();
  }, [refresh, role]);

  const value = useMemo(
    () => ({ role, isReady, data, error, signIn, signOut, switchDemoRole, refresh }),
    [data, error, isReady, refresh, role, signIn, signOut, switchDemoRole],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used inside AppProvider.');
  return value;
}