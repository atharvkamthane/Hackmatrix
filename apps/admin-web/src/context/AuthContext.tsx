import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import { apiClient, setAuthTokenProvider } from '../services/apiClient';
import { isDemoMode, setDemoMode } from '../services/adminService';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN';
  isDemo?: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  enterDemoMode: () => void;
  enterLocalAdminMode: () => void;
  isDemo: boolean;
}

interface ServerIdentity {
  userId: string;
  role: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, getToken: clerkGetToken, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [demoActive, setDemoActive] = useState<boolean>(() => isDemoMode());
  const [user, setUser] = useState<AdminUser | null>(() => {
    if (isDemoMode()) {
      return {
        id: 'admin_demo_01',
        name: 'Demo Administrator',
        email: 'admin@hackmatrix.local',
        role: 'ADMIN',
        isDemo: true,
      };
    }
    if (localStorage.getItem('hm_local_admin_session') === 'true') {
      return {
        id: 'admin_local_01',
        name: 'National Public Health Admin',
        email: 'admin@surveillance.local',
        role: 'ADMIN',
        isDemo: false,
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !isDemoMode());
  const [error, setError] = useState<string | null>(null);

  const enterDemoMode = useCallback(() => {
    localStorage.removeItem('hm_local_admin_session');
    setDemoMode(true);
    setDemoActive(true);
    setUser({
      id: 'admin_demo_01',
      name: 'Demo Administrator',
      email: 'admin@hackmatrix.local',
      role: 'ADMIN',
      isDemo: true,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const enterLocalAdminMode = useCallback(() => {
    localStorage.setItem('hm_local_admin_session', 'true');
    setDemoMode(false);
    setDemoActive(false);
    setUser({
      id: 'admin_local_01',
      name: 'National Public Health Admin',
      email: 'admin@surveillance.local',
      role: 'ADMIN',
      isDemo: false,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('hm_local_admin_session');
    setDemoMode(false);
    setDemoActive(false);
    setUser(null);
    setError(null);
    if (isSignedIn) {
      await signOut();
    }
  }, [isSignedIn, signOut]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (demoActive) return 'demo_token';
    if (user?.id === 'admin_local_01') return 'dev_admin_token';
    try {
      return (await clerkGetToken()) ?? null;
    } catch {
      return null;
    }
  }, [clerkGetToken, demoActive, user]);

  useEffect(() => {
    if (demoActive) {
      setIsLoading(false);
      return;
    }

    if (user?.id === 'admin_local_01') {
      setAuthTokenProvider(getToken);
      setIsLoading(false);
      return;
    }

    setAuthTokenProvider(isSignedIn ? getToken : null);
    let active = true;

    if (!isLoaded) {
      const timeout = setTimeout(() => {
        if (active) {
          setIsLoading(false);
          setError('Authentication service took too long to respond. You can retry or use Demo Mode.');
        }
      }, 5000);
      return () => {
        active = false;
        clearTimeout(timeout);
      };
    }

    if (!isSignedIn) {
      setUser(null);
      setError(null);
      setIsLoading(false);
      return () => {
        active = false;
        setAuthTokenProvider(null);
      };
    }

    setIsLoading(true);
    setError(null);
    void apiClient.get<ServerIdentity>('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        if (data.role !== 'ADMIN') {
          setError('This account is not assigned administrator access.');
          setUser(null);
          return;
        }
        setUser({
          id: data.userId,
          name: clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || 'Administrator',
          email: clerkUser?.primaryEmailAddress?.emailAddress || '',
          role: 'ADMIN',
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setUser(null);
        setError(cause instanceof Error ? cause.message : 'Unable to verify administrator access.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      setAuthTokenProvider(null);
    };
  }, [clerkUser, demoActive, getToken, isLoaded, isSignedIn, user?.id]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: user !== null,
    isSignedIn: Boolean(isSignedIn || demoActive || user !== null),
    isLoading,
    error,
    logout,
    getToken,
    enterDemoMode,
    enterLocalAdminMode,
    isDemo: demoActive,
  }), [demoActive, enterDemoMode, enterLocalAdminMode, error, getToken, isLoading, isSignedIn, logout, user]);

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
