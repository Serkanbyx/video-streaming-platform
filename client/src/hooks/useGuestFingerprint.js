import { useEffect, useState } from 'react';

const FINGERPRINT_KEY = 'fragment:fingerprint';

const generateUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

/**
 * Returns a stable per-browser UUID stored in localStorage. Used as the
 * dedupe identity for anonymous view counts so the server can collapse
 * reload spam without us shipping any PII.
 */
export const useGuestFingerprint = () => {
  const [fingerprint, setFingerprint] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const existing = window.localStorage.getItem(FINGERPRINT_KEY);
      if (existing) return existing;
      const fresh = generateUuid();
      window.localStorage.setItem(FINGERPRINT_KEY, fresh);
      return fresh;
    } catch {
      return generateUuid();
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const existing = window.localStorage.getItem(FINGERPRINT_KEY);
      if (!existing) window.localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    } catch {
      // Storage disabled — keep the in-memory value, view dedupe degrades gracefully.
    }
  }, [fingerprint]);

  return fingerprint;
};

export default useGuestFingerprint;
