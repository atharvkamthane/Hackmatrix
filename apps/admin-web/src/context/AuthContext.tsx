import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';
import { apiClient, setAuthTokenProvider } from '../services/apiClient';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN';
}

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

interface ServerIdentity {
  userId: string;
  role: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenProvider(isSignedIn ? getToken : null);
    let active = true;

    if (!isLoaded || !isSignedIn) {
      setUser(null);
      setError(null);
      setIsLoading(!isLoaded);
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
  }, [clerkUser, getToken, isLoaded, isSignedIn]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: user !== null,
    isSignedIn: Boolean(isSignedIn),
    isLoading,
    error,
    logout: signOut,
    getToken,
  }), [error, getToken, isLoading, isSignedIn, signOut, user]);

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
