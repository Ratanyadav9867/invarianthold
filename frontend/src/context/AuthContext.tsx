import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api, registerAuthErrorHandlers } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  quickLogin: (role: Role) => Promise<boolean>;
  isAdmin: boolean;
  isAnalyst: boolean;
  isViewer: boolean;
  canMutate: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo credentials loaded from .env defaults
export const DEMO_CREDENTIALS: Record<Role, { username: string; label: string; description: string }> = {
  ADMIN: {
    username: 'admin@invarianthold.io',
    label: 'SecOps Administrator',
    description: 'Full system control, failure injection, topology reset, invariant policy definition',
  },
  SECURITY_ANALYST: {
    username: 'analyst@invarianthold.io',
    label: 'SOC Security Analyst',
    description: 'Incident response, failure injection, traffic rerouting, simulation',
  },
  VIEWER: {
    username: 'viewer@invarianthold.io',
    label: 'Auditor / Viewer',
    description: 'Read-only access to dashboard, topology, and cryptographic audit ledger',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('invarianthold_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('invarianthold_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    registerAuthErrorHandlers(
      () => {
        setUser(null);
        setToken(null);
        setAuthError('Session expired. Please sign in again.');
      },
      (detail: string) => {
        setAuthError(detail);
      }
    );

    // Verify existing token on initial load
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('invarianthold_token');
      if (storedToken) {
        try {
          const me = await api.get<User>('/auth/me');
          setUser(me);
          localStorage.setItem('invarianthold_user', JSON.stringify(me));
        } catch {
          // Token invalid, clear
          localStorage.removeItem('invarianthold_token');
          localStorage.removeItem('invarianthold_user');
          setUser(null);
          setToken(null);
        }
      }
    };

    verifyToken();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await api.post('/auth/login', { username, password });
      const { access_token, user: userData } = res;
      localStorage.setItem('invarianthold_token', access_token);
      localStorage.setItem('invarianthold_user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Invalid username or password.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (role: Role): Promise<boolean> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const simpleCreds: Record<Role, { username: string; pass: string }> = {
        ADMIN: { username: 'admin', pass: 'admin123' },
        SECURITY_ANALYST: { username: 'analyst', pass: 'analyst123' },
        VIEWER: { username: 'viewer', pass: 'viewer123' },
      };
      const cred = simpleCreds[role];
      let ok = await login(cred.username, cred.pass);
      if (!ok) {
        const passwordMap: Record<Role, string> = {
          ADMIN: 'HSTAldqWJuGrFaH-iKU3lE91dBESYe5x',
          SECURITY_ANALYST: 'lHdCkHKx2qWlruAoc74Gt5yv9AyanfhQ',
          VIEWER: 'Q6xH8SAFkFlWJrAL1BE-rdqSZ09GF8G4',
        };
        ok = await login(DEMO_CREDENTIALS[role].username, passwordMap[role]);
      }
      return ok;
    } catch (err: any) {
      setAuthError(err.message || `Quick login for ${role} failed.`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('invarianthold_token');
    localStorage.removeItem('invarianthold_user');
    setUser(null);
    setToken(null);
    setAuthError(null);
  };

  const clearAuthError = () => setAuthError(null);

  const isAdmin = user?.role === 'ADMIN';
  const isAnalyst = user?.role === 'SECURITY_ANALYST';
  const isViewer = user?.role === 'VIEWER';
  const canMutate = isAdmin || isAnalyst;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        quickLogin,
        isAdmin,
        isAnalyst,
        isViewer,
        canMutate,
        authError,
        clearAuthError,
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
