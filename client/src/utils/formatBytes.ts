const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Formats a byte count into a compact human-readable string with up to one
 * fraction digit (`1.2 GB`, `512 KB`). Negative or non-finite values fall back
 * to `0 B` so callers can blindly forward server values.
 */
export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const exponent = Math.min(
    UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / 1024 ** exponent;
  const formatted = value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1);
  return `${formatted} ${UNITS[exponent]}`;
};

export default formatBytes;
