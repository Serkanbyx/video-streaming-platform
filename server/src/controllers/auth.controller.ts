import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { RequestHandler } from 'express';
import mongoose, { type Types } from 'mongoose';

import { env } from '../config/env.js';
import User, { type UserDoc } from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serializeUser = (userDoc: UserDoc) => {
  const user = userDoc.toJSON();
  delete (user as Record<string, unknown>).password;
  return user;
};

const removeProcessedFolder = async (videoId: string | Types.ObjectId): Promise<void> => {
  const target = path.resolve(__dirname, '..', '..', env.UPLOAD_DIR_PROCESSED, String(videoId));
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('cleanup_processed_failed', { videoId: String(videoId), errorMessage: message });
  }
};

const cascadeDeleteUserData = async (userId: Types.ObjectId): Promise<void> => {
  const Video = mongoose.models.Video;
  const Comment = mongoose.models.Comment;
  const Like = mongoose.models.Like;
  const Subscription = mongoose.models.Subscription;
  const View = mongoose.models.View;

  if (Video) {
    const ownedVideos = (await Video.find({ author: userId }).select('_id').lean()) as Array<{
      _id: Types.ObjectId;
    }>;
    await Promise.all(ownedVideos.map(({ _id }) => removeProcessedFolder(_id)));
    await Video.deleteMany({ author: userId });
  }
  if (Comment) await Comment.deleteMany({ author: userId });
  if (Like) await Like.deleteMany({ user: userId });
  if (Subscription) {
    await Subscription.deleteMany({
      $or: [{ subscriber: userId }, { channel: userId }],
    });
  }
  if (View) await View.deleteMany({ user: userId });
};

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body as {
    username: string;
    email: string;
    password: string;
  };

  const usernameLower = username.toLowerCase();
  const emailLower = email.toLowerCase();

  const existing = await User.findOne({
    $or: [{ email: emailLower }, { username: usernameLower }],
  }).lean();

  if (existing) throw httpError(409, 'Username or email is already taken');

  const user = await User.create({
    username: usernameLower,
    email: emailLower,
    password,
    role: 'viewer',
  });

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    data: { user: serializeUser(user), token },
  });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw httpError(401, 'Invalid email or password');

  const matches = await user.comparePassword(password);
  if (!matches) throw httpError(401, 'Invalid email or password');

  if (user.isBanned) throw httpError(403, 'Account suspended');

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user._id);

  res.json({
    success: true,
    data: { user: serializeUser(user), token },
  });
});

export const getMe: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  res.json({ success: true, data: { user: serializeUser(req.user) } });
});

export const updateProfile: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');

  const updates = req.body as Partial<{ displayName: string; bio: string; bannerUrl: string }>;

  Object.assign(req.user, updates);
  await req.user.save();

  res.json({ success: true, data: { user: serializeUser(req.user) } });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  if (currentPassword === newPassword) {
    throw httpError(422, 'New password must differ from current password');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw httpError(404, 'User not found');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw httpError(401, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Password updated' });
});

export const deleteAccount: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const { password } = req.body as { password: string };

  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw httpError(404, 'User not found');

  const matches = await user.comparePassword(password);
  if (!matches) throw httpError(401, 'Password is incorrect');

  await cascadeDeleteUserData(user._id);
  await user.deleteOne();

  logger.info('account_deleted', { userId: String(user._id) });

  res.json({ success: true, message: 'Account deleted' });
});
