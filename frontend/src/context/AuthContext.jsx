import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, getApiError, setUnauthenticatedHandler, tokenStorage, unwrap } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(Boolean(tokenStorage.get()));
  const [authenticated, setAuthenticated] = useState(false);

  // Restore session from a stored token via GET /api/auth/me.
  useEffect(() => {
    let cancelled = false;
    const token = tokenStorage.get();
    if (!token) return;
    authApi
      .me()
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setAuthenticated(true);
      })
      .catch(() => {
        if (cancelled) return;
        tokenStorage.clear();
      })
      .finally(() => { if (!cancelled) setInitializing(false); });
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(() => {
    // Backend has no revocation endpoint (access tokens expire on their own) — client-side clear only.
    tokenStorage.clear();
    setUser(null);
    setAuthenticated(false);
  }, []);

  useEffect(() => {
    setUnauthenticatedHandler(() => { tokenStorage.clear(); setUser(null); setAuthenticated(false); });
    return () => setUnauthenticatedHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const data = unwrap(await authApi.login({ email: email.trim().toLowerCase(), password }));
      tokenStorage.set(data.token);
      setUser(data.user);
      setAuthenticated(true);
      return { ok: true };
    } catch (error) {
      return { ok: false, ...getApiError(error) };
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      const data = unwrap(await authApi.register({ name: name.trim(), email: email.trim().toLowerCase(), password }));
      tokenStorage.set(data.token);
      setUser(data.user);
      setAuthenticated(true);
      return { ok: true };
    } catch (error) {
      return { ok: false, ...getApiError(error) };
    }
  }, []);

  const value = useMemo(
    () => ({ user, initializing, authenticated, login, register, logout }),
    [user, initializing, authenticated, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
