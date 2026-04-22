export const pickFields = <T extends Record<string, unknown>, K extends keyof T>(
  source: T | undefined | null,
  allowedKeys: readonly K[]
): Partial<Pick<T, K>> => {
  if (!source || typeof source !== 'object') return {};
  const result: Partial<Pick<T, K>> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};
