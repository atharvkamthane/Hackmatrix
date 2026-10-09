import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'PUBLIC_HEALTH_ADMIN' | 'EPIDEMIOLOGIST' | 'HEALTH_OFFICIAL';
  department: string;
  lastLogin: string;
}

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
}

const DEFAULT_ADMIN: AdminUser = {
  id: "usr_admin_0942",
  name: "Dr. Sarah Jenkins",
  email: "s.jenkins@publichealth.gov",
  role: "PUBLIC_HEALTH_ADMIN",
  department: "National Disease Surveillance Unit",
  lastLogin: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(DEFAULT_ADMIN);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Check session or stored tokens securely
    const storedAuth = localStorage.getItem('hm_admin_auth');
    if (storedAuth) {
      try {
        setUser(JSON.parse(storedAuth));
      } catch (e) {
        setUser(DEFAULT_ADMIN);
      }
    }
    setIsLoading(false);
  }, []);

  const login = () => {
    setUser(DEFAULT_ADMIN);
    localStorage.setItem('hm_admin_auth', JSON.stringify(DEFAULT_ADMIN));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('hm_admin_auth');
  };

  const getAuthHeader = (): Record<string, string> => {
    if (!user) return {};
    return {
      Authorization: `Bearer admin_oidc_token_${user.id}`,
      'X-Admin-Role': user.role,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        getAuthHeader,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
