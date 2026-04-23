/**
 * Formats a duration (in seconds) as a brutalist-friendly clock string.
 * - `< 1 hour` → `MM:SS`
 * - `>= 1 hour` → `H:MM:SS`
 *
 * Negative or non-finite inputs collapse to `00:00` so the UI never renders
 * `NaN:NaN` while a video is still being probed.
 */
export const formatDuration = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '00:00';

  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (value: number): string => value.toString().padStart(2, '0');

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
};

export default formatDuration;
