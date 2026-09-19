import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken } from '../services/api';
import type { Role } from '../types';

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (userId: string, password: string, portal: 'STUDENT' | 'STAFF' | 'ADMIN') => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.
    me().
    then((data) => {
      if (!cancelled) setUser(data.user as AuthUser);
    }).
    catch(() => {
      if (!cancelled) setUser(null);
    }).
    finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (userId: string, password: string, portal: 'STUDENT' | 'STAFF' | 'ADMIN') => {
      const data = await api.login(userId, password, portal);
      setToken(data.token);
      const authUser = data.user as AuthUser;
      setUser(authUser);
      return authUser;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}