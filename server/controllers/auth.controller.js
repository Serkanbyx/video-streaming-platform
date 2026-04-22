import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

import { env } from '../config/env.js';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { pickFields } from '../utils/pickFields.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REGISTER_FIELDS = ['username', 'email', 'password'];
const LOGIN_FIELDS = ['email', 'password'];
const PROFILE_UPDATE_FIELDS = ['displayName', 'bio', 'bannerUrl'];
const CHANGE_PASSWORD_FIELDS = ['currentPassword', 'newPassword'];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const serializeUser = (userDoc) => {
  const user = userDoc.toJSON ? userDoc.toJSON() : userDoc;
  delete user.password;
  return user;
};

const removeProcessedFolder = async (videoId) => {
  const target = path.resolve(__dirname, '..', env.UPLOAD_DIR_PROCESSED, String(videoId));
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    logger.warn('cleanup_processed_failed', { videoId: String(videoId), errorMessage: err.message });
  }
};

const cascadeDeleteUserData = async (userId) => {
  const Video = mongoose.models.Video;
  const Comment = mongoose.models.Comment;
  const Like = mongoose.models.Like;
  const Subscription = mongoose.models.Subscription;
  const View = mongoose.models.View;

  if (Video) {
    const ownedVideos = await Video.find({ creator: userId }).select('_id').lean();
    await Promise.all(ownedVideos.map(({ _id }) => removeProcessedFolder(_id)));
    await Video.deleteMany({ creator: userId });
  }
  if (Comment) await Comment.deleteMany({ user: userId });
  if (Like) await Like.deleteMany({ user: userId });
  if (Subscription) {
    await Subscription.deleteMany({
      $or: [{ subscriber: userId }, { channel: userId }],
    });
  }
  if (View) await View.deleteMany({ user: userId });
};

export const register = async (req, res, next) => {
  try {
    const payload = pickFields(req.body, REGISTER_FIELDS);

    if (!payload.username || !payload.email || !payload.password) {
      throw httpError(422, 'Username, email and password are required');
    }

    const usernameLower = String(payload.username).toLowerCase();
    const emailLower = String(payload.email).toLowerCase();

    const existing = await User.findOne({
      $or: [{ email: emailLower }, { username: usernameLower }],
    }).lean();

    if (existing) {
      throw httpError(409, 'Username or email is already taken');
    }

    const user = await User.create({
      username: usernameLower,
      email: emailLower,
      password: payload.password,
      role: 'viewer',
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: { user: serializeUser(user), token },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const payload = pickFields(req.body, LOGIN_FIELDS);
    if (!payload.email || !payload.password) {
      throw httpError(422, 'Email and password are required');
    }

    const user = await User.findOne({ email: String(payload.email).toLowerCase() }).select(
      '+password'
    );

    if (!user) {
      throw httpError(401, 'Invalid email or password');
    }

    const matches = await user.comparePassword(payload.password);
    if (!matches) {
      throw httpError(401, 'Invalid email or password');
    }

    if (user.isBanned) {
      throw httpError(403, 'Account suspended');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: { user: serializeUser(user), token },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({ success: true, data: { user: serializeUser(req.user) } });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const updates = pickFields(req.body, PROFILE_UPDATE_FIELDS);

    Object.assign(req.user, updates);
    await req.user.save();

    res.json({ success: true, data: { user: serializeUser(req.user) } });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = pickFields(req.body, CHANGE_PASSWORD_FIELDS);

    if (!currentPassword || !newPassword) {
      throw httpError(422, 'Current and new password are required');
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw httpError(422, 'New password must be at least 8 characters');
    }
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
  } catch (err) {
    next(err);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = pickFields(req.body, ['password']);
    if (!password) throw httpError(422, 'Password is required to delete account');

    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw httpError(404, 'User not found');

    const matches = await user.comparePassword(password);
    if (!matches) throw httpError(401, 'Password is incorrect');

    await cascadeDeleteUserData(user._id);
    await user.deleteOne();

    logger.info('account_deleted', { userId: String(user._id) });

    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
};
