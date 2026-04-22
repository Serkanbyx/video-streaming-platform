import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { logger } from '../utils/logger.js';
import User from '../models/User.js';

const SEED_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_USERNAME = process.env.SEED_ADMIN_USERNAME;
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const exitWith = async (code: number): Promise<never> => {
  await mongoose.disconnect().catch(() => {});
  process.exit(code);
};

const run = async (): Promise<void> => {
  if (!SEED_EMAIL || !SEED_USERNAME || !SEED_PASSWORD) {
    logger.error('seed_admin_missing_env', {
      hasEmail: Boolean(SEED_EMAIL),
      hasUsername: Boolean(SEED_USERNAME),
      hasPassword: Boolean(SEED_PASSWORD),
    });
    await exitWith(1);
  }

  if (env.isProduction && SEED_PASSWORD!.length < 12) {
    logger.error('seed_admin_weak_password', { minLength: 12 });
    await exitWith(1);
  }

  await connectDB();

  const existingAdmin = await User.findOne({ role: 'admin' }).lean();
  if (existingAdmin) {
    logger.info('seed_admin_skipped', {
      reason: 'admin_already_exists',
      adminId: String(existingAdmin._id),
      adminEmail: existingAdmin.email,
    });
    await exitWith(0);
  }

  const admin = await User.create({
    username: String(SEED_USERNAME).toLowerCase(),
    email: String(SEED_EMAIL).toLowerCase(),
    password: SEED_PASSWORD,
    role: 'admin',
    displayName: SEED_USERNAME,
  });

  logger.info('seed_admin_created', {
    adminId: String(admin._id),
    adminEmail: admin.email,
  });

  await exitWith(0);
};

run().catch(async (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('seed_admin_failed', { errorMessage: message, stack });
  await exitWith(1);
});
