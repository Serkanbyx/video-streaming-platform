import { env } from '../config/env.js';

const log = (level, message, context = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  stream(JSON.stringify(entry));
};

export const logger = {
  info: (message, context) => log('info', message, context),
  warn: (message, context) => log('warn', message, context),
  error: (message, context) => log('error', message, context),
  debug: (message, context) => env.NODE_ENV !== 'production' && log('debug', message, context),
};
