export const escapeRegex = (str = ''): string =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
