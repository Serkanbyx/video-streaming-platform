import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('[DB] connected');
  } catch (err) {
    console.error('[DB] connection failed:', err.message);
    process.exit(1);
  }
};
