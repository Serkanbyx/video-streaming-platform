import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { env } from '../config/env.js';
import User from '../models/User.js';
import { httpError } from '../utils/httpError.js';

const extractToken = (req: Parameters<RequestHandler>[0]): string | null => {
  const header = req.get('Authorization');
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const loadUserFromToken = async (token: string) => {
  const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload | string;
  if (typeof payload === 'string' || !payload?.id) return null;
  return User.findById(payload.id);
};

export const protect: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw httpError(401, 'Authentication required');

    const user = await loadUserFromToken(token);
    if (!user) throw httpError(401, 'Invalid or expired token');

    if (user.isBanned) throw httpError(403, 'Account suspended');

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
      return next(httpError(401, 'Invalid or expired token'));
    }
    next(err);
  }
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = null;
      return next();
    }
    const user = await loadUserFromToken(token);
    req.user = user && !user.isBanned ? user : null;
    next();
  } catch {
    req.user = null;
    next();
  }
};
