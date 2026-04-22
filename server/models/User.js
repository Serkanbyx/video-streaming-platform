import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_VALUES = ['viewer', 'creator', 'admin'];
const THEME_VALUES = ['light', 'dark', 'system'];
const ACCENT_VALUES = ['acid', 'magenta', 'electric', 'orange'];
const FONT_SIZE_VALUES = ['sm', 'md', 'lg'];
const DENSITY_VALUES = ['compact', 'comfortable'];
const ANIMATION_VALUES = ['full', 'reduced', 'off'];
const LANGUAGE_VALUES = ['en'];

const preferencesSchema = new mongoose.Schema(
  {
    theme: { type: String, enum: THEME_VALUES, default: 'dark' },
    accentColor: { type: String, enum: ACCENT_VALUES, default: 'acid' },
    fontSize: { type: String, enum: FONT_SIZE_VALUES, default: 'md' },
    density: { type: String, enum: DENSITY_VALUES, default: 'comfortable' },
    animations: { type: String, enum: ANIMATION_VALUES, default: 'full' },
    scanlines: { type: Boolean, default: true },
    language: { type: String, enum: LANGUAGE_VALUES, default: 'en' },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showHistory: { type: Boolean, default: false },
      showSubscriptions: { type: Boolean, default: true },
    },
    notifications: {
      newSubscriber: { type: Boolean, default: true },
      newComment: { type: Boolean, default: true },
    },
    content: {
      autoplay: { type: Boolean, default: false },
      defaultVolume: { type: Number, default: 0.8, min: 0, max: 1 },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [24, 'Username must be at most 24 characters'],
      match: [USERNAME_REGEX, 'Username may contain only letters, numbers and underscore'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_REGEX, 'Invalid email address'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: 'viewer',
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
      minlength: 1,
      maxlength: [48, 'Display name must be at most 48 characters'],
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [280, 'Bio must be at most 280 characters'],
    },
    avatarUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    subscriberCount: { type: Number, default: 0, min: 0, required: true },
    videoCount: { type: Number, default: 0, min: 0, required: true },
    totalViews: { type: Number, default: 0, min: 0, required: true },
    preferences: { type: preferencesSchema, default: () => ({}) },
    isBanned: { type: Boolean, default: false, required: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
});

userSchema.pre('save', function () {
  if (!this.displayName || !this.displayName.trim()) {
    this.displayName = this.username;
  }
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return false;
  return bcrypt.compare(plain, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
