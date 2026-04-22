import bcrypt from 'bcryptjs';
import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from 'mongoose';

import {
  PREFERENCE_ACCENTS,
  PREFERENCE_ANIMATIONS,
  PREFERENCE_DENSITIES,
  PREFERENCE_FONT_SIZES,
  PREFERENCE_LANGUAGES,
  PREFERENCE_THEMES,
  USER_ROLES,
  type UserRole,
} from '@shared/constants/enums.js';

import { env } from '../config/env.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const preferencesSchema = new Schema(
  {
    theme: { type: String, enum: PREFERENCE_THEMES, default: 'dark' },
    accentColor: { type: String, enum: PREFERENCE_ACCENTS, default: 'acid' },
    fontSize: { type: String, enum: PREFERENCE_FONT_SIZES, default: 'md' },
    density: { type: String, enum: PREFERENCE_DENSITIES, default: 'comfortable' },
    animations: { type: String, enum: PREFERENCE_ANIMATIONS, default: 'full' },
    scanlines: { type: Boolean, default: true },
    language: { type: String, enum: PREFERENCE_LANGUAGES, default: 'en' },
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

const userSchema = new Schema(
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
      enum: USER_ROLES,
      default: 'viewer' satisfies UserRole,
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
        delete (ret as Record<string, unknown>).password;
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

interface UserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const password = this.get('password');
  if (typeof password !== 'string') return;
  this.set('password', await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS));
});

userSchema.pre('save', function () {
  const displayName = this.get('displayName');
  if (!displayName || (typeof displayName === 'string' && !displayName.trim())) {
    this.set('displayName', this.get('username'));
  }
});

userSchema.methods.comparePassword = function comparePassword(plain: string): Promise<boolean> {
  const password = this.get('password');
  if (!password) return Promise.resolve(false);
  return bcrypt.compare(plain, password);
};

export type UserDoc = HydratedDocument<
  {
    username: string;
    email: string;
    password?: string;
    role: UserRole;
    displayName?: string;
    bio: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    subscriberCount: number;
    videoCount: number;
    totalViews: number;
    preferences: Record<string, unknown>;
    isBanned: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  UserMethods
>;

export type UserModel = Model<UserDoc, {}, UserMethods>;

const User = (models.User as UserModel) || model<UserDoc, UserModel>('User', userSchema);

export default User;
