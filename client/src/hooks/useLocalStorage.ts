import { useCallback, useEffect, useState } from 'react';

type Updater<T> = T | ((current: T) => T);

const readFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * Stateful value mirrored to `localStorage`. Behaves like `useState` but
 * persists across reloads and syncs across tabs via the `storage` event.
 */
export const useLocalStorage = <T>(
  key: string,
  defaultValue: T
): [T, (next: Updater<T>) => void, () => void] => {
  const [value, setValue] = useState<T>(() => readFromStorage(key, defaultValue));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== key) return;
      if (event.newValue === null) {
        setValue(defaultValue);
        return;
      }
      try {
        setValue(JSON.parse(event.newValue) as T);
      } catch {
        setValue(defaultValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [key, defaultValue]);

  const setStoredValue = useCallback(
    (next: Updater<T>) => {
      setValue((current) => {
        const resolved =
          typeof next === 'function' ? (next as (current: T) => T)(current) : next;
        try {
          if (resolved === undefined || resolved === null) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(resolved));
          }
        } catch {
          /* quota exceeded or storage disabled — keep in-memory state */
        }
        return resolved;
      });
    },
    [key]
  );

  const removeStoredValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setValue(defaultValue);
  }, [key, defaultValue]);

  return [value, setStoredValue, removeStoredValue];
};

export default useLocalStorage;
