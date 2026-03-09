// apps/client/src/modules/auth/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../common/apiClient'; // pouzivame /auth/* a /api/*

const AdminCtx = createContext(null);

// Client token - POUZE pro client, NIKDY nesmi byt smazan admin logoutem
const CLIENT_TOKEN_KEY = 'am_client_token';
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minut neaktivity

function getStoredToken() {
  return localStorage.getItem(CLIENT_TOKEN_KEY);
}

function setStoredToken(token) {
  if (token) {
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(CLIENT_TOKEN_KEY);
  }
}

function clearStoredToken() {
  localStorage.removeItem(CLIENT_TOKEN_KEY);
}

/**
 * Auth pro CLIENT (zakaznici) - IZOLOVANE od admin auth
 * - token v localStorage ('am_client_token')
 * - /api/v1/auth/login vraci access_token, /api/v1/auth/me vraci pouze minimalni info
 * - NIKDY nesmi ovlivnit admin token ('am_admin_token')
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Idle logout
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const setAuthHeader = useCallback((token) => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/api/v1/auth/me');
      const norm = data
        ? {
            id: data.id,
            role: data.role ?? null,
            is_active: !!data.is_active,
          }
        : null;
      setUser(norm);
      return norm;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const authenticateWithToken = useCallback(async (token) => {
    if (!token) throw new Error('Missing access token');
    setLoading(true);
    setStoredToken(token);
    setAuthHeader(token);

    const me = await fetchMe();
    if (!me) {
      clearStoredToken();
      setAuthHeader(null);
      throw new Error('Profil se nepodarilo nacist');
    }
    return me;
  }, [fetchMe, setAuthHeader]);

  useEffect(() => {
    const t = getStoredToken();
    if (t) {
      setAuthHeader(t);
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [fetchMe, setAuthHeader]);

  const logoutFn = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // ignore
    }
    clearStoredToken();
    setAuthHeader(null);
    setUser(null);
  }, [setAuthHeader]);

  const loginFn = useCallback(async (email, password) => {
    const { data } = await api.post('/api/v1/auth/login', { email, password });
    const token = data?.access_token;
    if (!token) throw new Error('Login bez access_token');
    await authenticateWithToken(token);
  }, [authenticateWithToken]);

  // Auto logout po 10 minutach neaktivity
  useEffect(() => {
    if (!user) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return undefined;
    }

    const reset = () => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        const diff = Date.now() - lastActivityRef.current;
        if (diff >= IDLE_TIMEOUT_MS) logoutFn();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove'];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user, logoutFn]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login: loginFn,
      logout: logoutFn,
      authenticateWithToken,
    }),
    [user, loading, loginFn, logoutFn, authenticateWithToken]
  );

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Default export aby fungoval jak default tak pojmenovany import
export default AuthProvider;
