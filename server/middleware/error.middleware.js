import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.id,
  });
};

const normalizeError = (err) => {
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.keys(err.errors);
    const firstField = fields[0];
    const detail = firstField ? err.errors[firstField].message : 'Validation failed';
    return { status: 422, message: detail };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, message: 'Invalid identifier' };
  }

  if (err && err.code === 11000) {
    return { status: 409, message: 'Resource already exists' };
  }

  if (err && err.name === 'JsonWebTokenError') {
    return { status: 401, message: 'Invalid token' };
  }

  if (err && err.name === 'TokenExpiredError') {
    return { status: 401, message: 'Token expired' };
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message =
    env.isProduction && status === 500
      ? 'Internal server error'
      : err?.message || 'Internal server error';

  return { status, message };
};

export const errorHandler = (err, req, res, _next) => {
  const { status, message } = normalizeError(err);

  logger.error('request_failed', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    errorName: err?.name,
    errorMessage: err?.message,
    stack: env.isProduction ? undefined : err?.stack,
  });

  res.status(status).json({
    success: false,
    message,
    requestId: req.id,
  });
};
