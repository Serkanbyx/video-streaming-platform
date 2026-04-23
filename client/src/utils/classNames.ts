type ClassValue = string | number | false | null | undefined;

/**
 * Tiny `clsx`-style joiner. Filters falsy values so callers can use inline
 * conditionals like `cn('a', isActive && 'b')` without leaking `false` into
 * the rendered class string.
 */
export const cn = (...values: ClassValue[]): string =>
  values.filter((value): value is string | number => Boolean(value)).join(' ');

export default cn;
