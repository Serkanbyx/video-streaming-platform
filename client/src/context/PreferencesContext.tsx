import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import * as userService from '../services/user.service.js';
import { useAuth } from './AuthContext.js';

import type { UserPreferences } from '@shared/types/user.js';

const GUEST_PREFS_KEY = 'fragment:prefs';

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  accentColor: 'acid',
  fontSize: 'md',
  density: 'comfortable',
  animations: 'full',
  scanlines: true,
  language: 'en',
  privacy: {
    showEmail: false,
    showHistory: false,
    showSubscriptions: true,
  },
  notifications: {
    newSubscriber: true,
    newComment: true,
  },
  content: {
    autoplay: false,
    defaultVolume: 0.8,
  },
};

interface PreferencesContextValue {
  preferences: UserPreferences;
  loading: boolean;
  defaults: UserPreferences;
  updatePreference: (path: string, value: unknown) => Promise<void>;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// Deep merge so partial updates from the server (or older guest payloads
// missing a new field) don't strip out the defaults we expect downstream.
const mergePreferences = <T extends object>(
  base: T,
  override: Partial<T> | null | undefined
): T => {
  if (!override || typeof override !== 'object') return base;
  const baseObj = base as Record<string, unknown>;
  const overrideObj = override as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...baseObj };
  for (const key of Object.keys(overrideObj)) {
    const baseValue = baseObj[key];
    const overrideValue = overrideObj[key];
    if (
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue)
    ) {
      merged[key] = mergePreferences(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      );
    } else if (overrideValue !== undefined) {
      merged[key] = overrideValue;
    }
  }
  return merged as T;
};

const setNestedValue = <T extends object>(obj: T, path: string, value: unknown): T => {
  const keys = path.split('.');
  const next: Record<string, unknown> = Array.isArray(obj)
    ? ([...(obj as unknown[])] as unknown as Record<string, unknown>)
    : { ...(obj as Record<string, unknown>) };
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    cursor[key] =
      cursor[key] && typeof cursor[key] === 'object'
        ? { ...(cursor[key] as Record<string, unknown>) }
        : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]!] = value;
  return next as T;
};

const readGuestPreferences = (): UserPreferences => {
  if (typeof window === 'undefined') return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(GUEST_PREFS_KEY);
    if (!raw) return defaultPreferences;
    return mergePreferences(defaultPreferences, JSON.parse(raw) as Partial<UserPreferences>);
  } catch {
    return defaultPreferences;
  }
};

const writeGuestPreferences = (prefs: UserPreferences): void => {
  try {
    window.localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage disabled — preferences live for this session only */
  }
};

interface PreferencesProviderProps {
  children: ReactNode;
}

export const PreferencesProvider = ({ children }: PreferencesProviderProps) => {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(() => readGuestPreferences());
  const [loading, setLoading] = useState<boolean>(false);

  // Track the user we last hydrated for so re-renders of `user` (e.g. counter
  // updates) don't trigger a redundant /preferences fetch on every change.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    const userKey = user?._id ?? 'guest';
    if (hydratedFor.current === userKey) return undefined;
    hydratedFor.current = userKey;

    let cancelled = false;

    if (!isAuthenticated) {
      setPreferences(readGuestPreferences());
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    (async () => {
      try {
        const data = await userService.getPreferences();
        const incoming = (data.preferences ?? data) as Partial<UserPreferences>;
        if (!cancelled) setPreferences(mergePreferences(defaultPreferences, incoming));
      } catch {
        if (!cancelled) setPreferences(defaultPreferences);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthenticated]);

  // Apply theme + brutalist data-attributes on <html> so CSS can react.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;

    const applyTheme = (theme: UserPreferences['theme']): void => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', Boolean(isDark));
    };

    applyTheme(preferences.theme);

    root.dataset.density = preferences.density;
    root.dataset.fontsize = preferences.fontSize;
    root.dataset.accent = preferences.accentColor;
    root.dataset.scanlines = String(preferences.scanlines);
    root.dataset.motion = preferences.animations;

    if (preferences.theme !== 'system' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (): void => applyTheme('system');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preferences]);

  const updatePreference = useCallback(
    async (path: string, value: unknown): Promise<void> => {
      let nextPreferences: UserPreferences = preferences;
      setPreferences((current) => {
        nextPreferences = setNestedValue(current, path, value);
        return nextPreferences;
      });

      if (!isAuthenticated) {
        writeGuestPreferences(nextPreferences);
        return;
      }

      try {
        await userService.updatePreferences({ [path]: value } as never);
      } catch {
        try {
          const data = await userService.getPreferences();
          const incoming = (data.preferences ?? data) as Partial<UserPreferences>;
          setPreferences(mergePreferences(defaultPreferences, incoming));
        } catch {
          /* keep optimistic state */
        }
      }
    },
    [isAuthenticated, preferences]
  );

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    if (!isAuthenticated) writeGuestPreferences(defaultPreferences);
  }, [isAuthenticated]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      loading,
      defaults: defaultPreferences,
      updatePreference,
      resetPreferences,
    }),
    [preferences, loading, updatePreference, resetPreferences]
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextValue => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
};

export { defaultPreferences };
export default PreferencesContext;
