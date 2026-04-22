import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export const generateToken = (userId) =>
  jwt.sign({ id: String(userId) }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
