import { useEffect, useState } from 'react';

import { usePreferences } from '../context/PreferencesContext.js';

const MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns `true` when motion should be suppressed — either because the OS
 * advertises `prefers-reduced-motion: reduce` or because the user has dialed
 * their `preferences.animations` setting down to `reduced` / `off`.
 */
export const useReducedMotion = (): boolean => {
  const { preferences } = usePreferences();
  const [systemPrefersReduced, setSystemPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia(MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent): void =>
      setSystemPrefersReduced(event.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const userPreference = preferences?.animations ?? 'full';
  if (userPreference === 'off' || userPreference === 'reduced') return true;
  return systemPrefersReduced;
};

export default useReducedMotion;
