import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';
import { env } from './env.js';

export const connectDB = async (): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    logger.info('[DB] connected');
    return conn;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[DB] connection failed', { error: message });
    process.exit(1);
  }
};
