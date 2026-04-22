import { useEffect, useState } from 'react';

/**
 * Returns a copy of `value` that only updates after `delay` ms of stillness.
 * Useful for search inputs so we don't fire a request on every keystroke.
 */
export const useDebounce = <T>(value: T, delay = 300): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

export default useDebounce;
