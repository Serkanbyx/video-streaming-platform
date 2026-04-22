import mongoose from 'mongoose';

import { env } from './env.js';

export const connectDB = async (): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log('[DB] connected');
    return conn;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DB] connection failed:', message);
    process.exit(1);
  }
};
