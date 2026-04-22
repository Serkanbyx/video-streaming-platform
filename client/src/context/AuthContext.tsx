import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';

import type { AuthUser } from '@shared/types/user.js';
import type {
  LoginInput,
  RegisterInput,
} from '@shared/schemas/auth.schema.js';

const TOKEN_KEY = 'fragment:token';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  login: (credentials: LoginInput) => Promise<AuthUser>;
  register: (credentials: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  becomeCreator: () => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const readToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage disabled — auth is in-memory only for this session */
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => readToken());
  const [loading, setLoading] = useState<boolean>(Boolean(readToken()));

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

  const persistSession = useCallback(
    (nextUser: AuthUser | null, nextToken: string | null) => {
      writeToken(nextToken);
      setToken(nextToken);
      setUser(nextUser);
    },
    []
  );

  const login = useCallback(
    async (credentials: LoginInput): Promise<AuthUser> => {
      const data = await authService.login(credentials);
      persistSession(data.user, data.token);
      return data.user;
    },
    [persistSession]
  );

  const register = useCallback(
    async (credentials: RegisterInput): Promise<AuthUser> => {
      const data = await authService.register(credentials);
      persistSession(data.user, data.token);
      return data.user;
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    persistSession(null, null);
  }, [persistSession]);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((current) => (current ? { ...current, ...partial } : current));
  }, []);

  const becomeCreator = useCallback(async (): Promise<AuthUser> => {
    const data = await userService.becomeCreator();
    const updated = data.user;
    setUser((current) => (current ? { ...current, ...updated } : updated));
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
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

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
