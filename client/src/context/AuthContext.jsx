import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';

const TOKEN_KEY = 'fragment:token';

const AuthContext = createContext(null);

const readToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage disabled — auth is in-memory only for this session.
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => readToken());
  const [loading, setLoading] = useState(Boolean(readToken()));

  // Hydrate the session: if we have a token from a previous visit, verify it
  // by calling /me. On 401 the axios interceptor already purges the token and
  // bounces to /login, so we only need to clear local state here.
  useEffect(() => {
    let cancelled = false;
    const storedToken = readToken();

    if (!storedToken) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      try {
        const data = await authService.getMe();
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) {
          writeToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = useCallback((nextUser, nextToken) => {
    writeToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    persistSession(data.user, data.token);
    return data.user;
  }, [persistSession]);

  const register = useCallback(async (credentials) => {
    const data = await authService.register(credentials);
    persistSession(data.user, data.token);
    return data.user;
  }, [persistSession]);

  const logout = useCallback(() => {
    persistSession(null, null);
  }, [persistSession]);

  const updateUser = useCallback((partial) => {
    setUser((current) => (current ? { ...current, ...partial } : current));
  }, []);

  const becomeCreator = useCallback(async () => {
    const data = await userService.becomeCreator();
    const updated = data.user ?? data;
    setUser((current) => (current ? { ...current, ...updated } : updated));
    return updated;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      isAdmin: user?.role === 'admin',
      isCreator: user?.role === 'creator' || user?.role === 'admin',
      login,
      register,
      logout,
      updateUser,
      becomeCreator,
    }),
    [user, token, loading, login, register, logout, updateUser, becomeCreator]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
