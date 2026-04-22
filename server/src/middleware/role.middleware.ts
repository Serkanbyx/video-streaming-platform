import type { RequestHandler } from 'express';

import { httpError } from '../utils/httpError.js';

export const adminOnly: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(httpError(401, 'Authentication required'));
  if (req.user.role !== 'admin') return next(httpError(403, 'Admin access required'));
  next();
};

export const creatorOrAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(httpError(401, 'Authentication required'));
  if (req.user.role !== 'creator' && req.user.role !== 'admin') {
    return next(httpError(403, 'Creator access required'));
  }
  next();
};
