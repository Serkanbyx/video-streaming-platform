import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import User from '../models/User.js';

const extractToken = (req) => {
  const header = req.get('Authorization');
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim() || null;
};

const loadUserFromToken = async (token) => {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (!payload?.id) return null;
  return User.findById(payload.id);
};

export const protect = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      const err = new Error('Authentication required');
      err.status = 401;
      throw err;
    }

    const user = await loadUserFromToken(token);
    if (!user) {
      const err = new Error('Invalid or expired token');
      err.status = 401;
      throw err;
    }

    if (user.isBanned) {
      const err = new Error('Account suspended');
      err.status = 403;
      throw err;
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      const authError = new Error('Invalid or expired token');
      authError.status = 401;
      return next(authError);
    }
    next(err);
  }
};

export const optionalAuth = async (req, _res, next) => {
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
