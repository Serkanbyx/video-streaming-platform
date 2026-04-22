import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.id,
  });
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode = Number.isInteger(err.status) ? err.status : 500;

  logger.error('request_failed', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorMessage: err.message,
    stack: env.isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    success: false,
    message: env.isProduction && statusCode === 500 ? 'Internal server error' : err.message,
    requestId: req.id,
  });
};
