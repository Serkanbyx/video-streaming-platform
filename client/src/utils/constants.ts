export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

/**
 * Resolves a relative server-side asset path (e.g. `/api/stream/<id>/thumb.jpg`)
 * to an absolute URL using the configured API base. Pass-through for absolute
 * URLs and falsy values so callers can blindly forward whatever the API
 * returned without an extra null check.
 */
export const resolveAssetUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};
