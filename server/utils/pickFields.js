export const pickFields = (source, allowedKeys) => {
  if (!source || typeof source !== 'object') return {};
  const result = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
};
