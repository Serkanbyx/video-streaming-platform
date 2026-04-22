import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as userService from '../services/user.service.js';
import { useAuth } from './AuthContext.jsx';

const GUEST_PREFS_KEY = 'fragment:prefs';

const defaultPreferences = {
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

const PreferencesContext = createContext(null);

// Deep merge so partial updates from the server (or older guest payloads
// missing a new field) don't strip out the defaults we expect downstream.
const mergePreferences = (base, override) => {
  if (!override || typeof override !== 'object') return base;
  const merged = { ...base };
  for (const key of Object.keys(override)) {
    const baseValue = base[key];
    const overrideValue = override[key];
    if (
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue) &&
      overrideValue &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue)
    ) {
      merged[key] = mergePreferences(baseValue, overrideValue);
    } else if (overrideValue !== undefined) {
      merged[key] = overrideValue;
    }
  }
  return merged;
};

const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    cursor[key] = cursor[key] && typeof cursor[key] === 'object' ? { ...cursor[key] } : {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
};

const readGuestPreferences = () => {
  if (typeof window === 'undefined') return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(GUEST_PREFS_KEY);
    if (!raw) return defaultPreferences;
    return mergePreferences(defaultPreferences, JSON.parse(raw));
  } catch {
    return defaultPreferences;
  }
};

const writeGuestPreferences = (prefs) => {
  try {
    window.localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage disabled — preferences live for this session only.
  }
};

export const PreferencesProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState(() => readGuestPreferences());
  const [loading, setLoading] = useState(false);

  // Track the user we last hydrated for so re-renders of `user` (e.g. counter
  // updates) don't trigger a redundant /preferences fetch on every change.
  const hydratedFor = useRef(null);

  useEffect(() => {
    const userKey = user?._id ?? 'guest';
    if (hydratedFor.current === userKey) return undefined;
    hydratedFor.current = userKey;

    let cancelled = false;

    if (!isAuthenticated) {
      setPreferences(readGuestPreferences());
      return () => { cancelled = true; };
    }

    setLoading(true);
    (async () => {
      try {
        const data = await userService.getPreferences();
        const incoming = data.preferences ?? data;
        if (!cancelled) setPreferences(mergePreferences(defaultPreferences, incoming));
      } catch {
        if (!cancelled) setPreferences(defaultPreferences);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, isAuthenticated]);

  // Apply theme + brutalist data-attributes on <html> so CSS in STEP 20 can react.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;

    const applyTheme = (theme) => {
      const isDark = theme === 'dark' ||
        (theme === 'system' &&
          window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };

    applyTheme(preferences.theme);

    root.dataset.density = preferences.density;
    root.dataset.fontsize = preferences.fontSize;
    root.dataset.accent = preferences.accentColor;
    root.dataset.scanlines = String(preferences.scanlines);
    root.dataset.motion = preferences.animations;

    if (preferences.theme !== 'system' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [preferences]);

  const updatePreference = useCallback(
    async (path, value) => {
      // Optimistic local update so the UI reflects the change immediately.
      let nextPreferences;
      setPreferences((current) => {
        nextPreferences = setNestedValue(current, path, value);
        return nextPreferences;
      });

      if (!isAuthenticated) {
        writeGuestPreferences(nextPreferences);
        return;
      }

      try {
        await userService.updatePreferences({ [path]: value });
      } catch {
        // Server rejected the change — fall back to whatever it has on file.
        try {
          const data = await userService.getPreferences();
          const incoming = data.preferences ?? data;
          setPreferences(mergePreferences(defaultPreferences, incoming));
        } catch {
          // If even the refetch fails, keep the optimistic state and let the
          // axios interceptor surface the original error toast.
        }
      }
    },
    [isAuthenticated]
  );

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    if (!isAuthenticated) writeGuestPreferences(defaultPreferences);
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      preferences,
      loading,
      defaults: defaultPreferences,
      updatePreference,
      resetPreferences,
    }),
    [preferences, loading, updatePreference, resetPreferences]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
};

export { defaultPreferences };
export default PreferencesContext;
