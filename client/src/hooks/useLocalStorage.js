import { useCallback, useEffect, useState } from 'react';

const readFromStorage = (key, defaultValue) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
};

/**
 * Stateful value mirrored to `localStorage`. Behaves like `useState` but
 * persists across reloads and syncs across tabs via the `storage` event.
 */
export const useLocalStorage = (key, defaultValue) => {
  const [value, setValue] = useState(() => readFromStorage(key, defaultValue));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event) => {
      if (event.key !== key) return;
      setValue(event.newValue === null ? defaultValue : (() => {
        try { return JSON.parse(event.newValue); } catch { return defaultValue; }
      })());
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key, defaultValue]);

  const setStoredValue = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        try {
          if (resolved === undefined || resolved === null) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          }
        } catch {
          // Quota exceeded or storage disabled — keep in-memory state and move on.
        }
        return resolved;
      });
    },
    [key]
  );

  const removeStoredValue = useCallback(() => {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    setValue(defaultValue);
  }, [key, defaultValue]);

  return [value, setStoredValue, removeStoredValue];
};

export default useLocalStorage;
