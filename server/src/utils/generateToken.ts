import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Types } from 'mongoose';

import { env } from '../config/env.js';

export const generateToken = (userId: string | Types.ObjectId): string => {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ id: String(userId) }, env.JWT_SECRET, options);
};
