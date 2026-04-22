import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/httpError.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestId: req.id,
  });
};

interface NormalizedError {
  status: number;
  message: string;
}

const normalizeError = (err: unknown): NormalizedError => {
  if (err instanceof HttpError) {
    return { status: err.status, message: err.message };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.keys(err.errors);
    const firstField = fields[0];
    const detail = firstField ? err.errors[firstField]?.message ?? 'Validation failed' : 'Validation failed';
    return { status: 422, message: detail };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { status: 400, message: 'Invalid identifier' };
  }

  if (err && typeof err === 'object') {
    const candidate = err as { code?: number; name?: string; message?: string; status?: unknown };

    if (candidate.code === 11000) {
      return { status: 409, message: 'Resource already exists' };
    }
    if (candidate.name === 'JsonWebTokenError') {
      return { status: 401, message: 'Invalid token' };
    }
    if (candidate.name === 'TokenExpiredError') {
      return { status: 401, message: 'Token expired' };
    }

    const status = Number.isInteger(candidate.status) ? (candidate.status as number) : 500;
    const message =
      env.isProduction && status === 500
        ? 'Internal server error'
        : candidate.message || 'Internal server error';
    return { status, message };
  }

  return { status: 500, message: 'Internal server error' };
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { status, message } = normalizeError(err);
  const errorObj = err as { name?: string; message?: string; stack?: string } | undefined;

  logger.error('request_failed', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    errorName: errorObj?.name,
    errorMessage: errorObj?.message,
    stack: env.isProduction ? undefined : errorObj?.stack,
  });

  res.status(status).json({
    success: false,
    message,
    requestId: req.id,
  });
};
