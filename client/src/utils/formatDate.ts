const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Renders a relative timestamp (`3 days ago`, `just now`) without leaking
 * future-dated edge cases: clock skew or upload races may produce a tiny
 * negative delta which we floor at the lowest unit.
 */
export const formatRelativeDate = (input: string | Date): string => {
  const target = input instanceof Date ? input : new Date(input);
  const delta = target.getTime() - Date.now();
  const absolute = Math.abs(delta);

  if (absolute < MINUTE) return 'just now';

  const units: Array<{ ms: number; unit: Intl.RelativeTimeFormatUnit }> = [
    { ms: YEAR, unit: 'year' },
    { ms: MONTH, unit: 'month' },
    { ms: WEEK, unit: 'week' },
    { ms: DAY, unit: 'day' },
    { ms: HOUR, unit: 'hour' },
    { ms: MINUTE, unit: 'minute' },
  ];

  for (const { ms, unit } of units) {
    if (absolute >= ms) {
      const value = Math.round(delta / ms);
      return relativeFormatter.format(value, unit);
    }
  }
  return 'just now';
};

const absoluteFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

export const formatAbsoluteDate = (input: string | Date): string => {
  const target = input instanceof Date ? input : new Date(input);
  return absoluteFormatter.format(target);
};

export default formatRelativeDate;
