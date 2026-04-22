import { env } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogContext = Record<string, unknown>;

const log = (level: LogLevel, message: string, context: LogContext = {}): void => {
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
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  debug: (message: string, context?: LogContext) => {
    if (env.NODE_ENV !== 'production') log('debug', message, context);
  },
};
