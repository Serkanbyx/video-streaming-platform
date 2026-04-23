/**
 * Compact view-count formatter (e.g. `1.2K`, `3.4M`, `123`). Uses
 * `Intl.NumberFormat` with the `compact` notation so locale-aware output is
 * free, then upper-cases the unit suffix to match the brutalist mono voice.
 */
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatViews = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return compactFormatter.format(value).toUpperCase();
};

export default formatViews;
