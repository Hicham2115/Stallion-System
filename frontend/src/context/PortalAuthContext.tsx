import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PortalUser } from '@/types';

const portalApi = axios.create({
  baseURL: '/api/portal',
  headers: { 'Content-Type': 'application/json' },
});

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('stallion_portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface PortalAuthState {
  user: PortalUser | null;
  token: string | null;
  isLoading: boolean;
}

interface PortalAuthContextValue extends PortalAuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: PortalUser) => void;
  api: typeof portalApi;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export function PortalAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PortalAuthState>({
    user: null,
    token: localStorage.getItem('stallion_portal_token'),
    isLoading: true,
  });

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('stallion_portal_token');
    if (!token) { setState((s) => ({ ...s, isLoading: false })); return; }
    try {
      const { data } = await portalApi.get<PortalUser>('/me');
      setState({ user: data, token, isLoading: false });
    } catch {
      localStorage.removeItem('stallion_portal_token');
      setState({ user: null, token: null, isLoading: false });
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const { data } = await portalApi.post<{ token: string; user: PortalUser }>('/login', { email, password });
    localStorage.setItem('stallion_portal_token', data.token);
    setState({ user: data.user, token: data.token, isLoading: false });
  };

  const logout = () => {
    localStorage.removeItem('stallion_portal_token');
    setState({ user: null, token: null, isLoading: false });
  };

  const updateUser = (user: PortalUser) => {
    setState((s) => ({ ...s, user }));
  };

  return (
    <PortalAuthContext.Provider value={{ ...state, login, logout, updateUser, api: portalApi }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error('usePortalAuth must be used inside PortalAuthProvider');
  return ctx;
}

export { portalApi };
