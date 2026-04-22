import type { RequestHandler } from 'express';

import User, { type UserDoc } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

const PROFILE_PROJECTION =
  'username displayName bio avatarUrl bannerUrl subscriberCount videoCount totalViews createdAt';

type PrefValidator =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'boolean' }
  | { kind: 'range'; min: number; max: number };

const PREFERENCE_VALIDATORS: Record<string, PrefValidator> = {
  theme: { kind: 'enum', values: ['light', 'dark', 'system'] },
  accentColor: { kind: 'enum', values: ['acid', 'magenta', 'electric', 'orange'] },
  fontSize: { kind: 'enum', values: ['sm', 'md', 'lg'] },
  density: { kind: 'enum', values: ['compact', 'comfortable'] },
  animations: { kind: 'enum', values: ['full', 'reduced', 'off'] },
  scanlines: { kind: 'boolean' },
  language: { kind: 'enum', values: ['en'] },
  'privacy.showEmail': { kind: 'boolean' },
  'privacy.showHistory': { kind: 'boolean' },
  'privacy.showSubscriptions': { kind: 'boolean' },
  'notifications.newSubscriber': { kind: 'boolean' },
  'notifications.newComment': { kind: 'boolean' },
  'content.autoplay': { kind: 'boolean' },
  'content.defaultVolume': { kind: 'range', min: 0, max: 1 },
};

const ALLOWED_TOP_LEVEL_KEYS = new Set(
  Object.keys(PREFERENCE_VALIDATORS).map((path) => path.split('.')[0]!)
);

interface PublicProfileLike {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  subscriberCount?: number;
  videoCount?: number;
  totalViews?: number;
  createdAt: Date | string;
}

const serializePublicProfile = (user: PublicProfileLike) => ({
  username: user.username,
  displayName: user.displayName ?? user.username,
  bio: user.bio ?? '',
  avatarUrl: user.avatarUrl ?? null,
  bannerUrl: user.bannerUrl ?? null,
  subscriberCount: user.subscriberCount ?? 0,
  videoCount: user.videoCount ?? 0,
  totalViews: user.totalViews ?? 0,
  createdAt: user.createdAt,
});

const serializeUser = (userDoc: UserDoc) => {
  const user = userDoc.toJSON();
  delete (user as Record<string, unknown>).password;
  return user;
};

const readPath = (source: unknown, dottedPath: string): unknown => {
  const segments = dottedPath.split('.');
  let cursor: unknown = source;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
};

const isValidValue = (value: unknown, validator: PrefValidator): boolean => {
  if (value === null || value === undefined) return false;
  switch (validator.kind) {
    case 'enum':
      return typeof value === 'string' && validator.values.includes(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'range':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= validator.min &&
        value <= validator.max
      );
    default:
      return false;
  }
};

export const getPublicProfile: RequestHandler = asyncHandler(async (req, res) => {
  const raw = req.params.username;
  if (typeof raw !== 'string' || !USERNAME_REGEX.test(raw)) {
    throw httpError(400, 'Invalid username');
  }

  const user = await User.findOne({ username: raw.toLowerCase() })
    .select(`${PROFILE_PROJECTION} isBanned`)
    .lean();

  if (!user || user.isBanned) throw httpError(404, 'Channel not found');

  res.json({ success: true, data: serializePublicProfile(user as PublicProfileLike) });
});

export const getPreferences: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const prefs = req.user.preferences as { toObject?: () => Record<string, unknown> } | undefined;
  const preferences = prefs?.toObject ? prefs.toObject() : prefs ?? {};
  res.json({ success: true, data: { preferences } });
});

export const updatePreferences: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  const acceptedPaths: string[] = [];
  const rejectedPaths: string[] = [];

  for (const [path, validator] of Object.entries(PREFERENCE_VALIDATORS)) {
    const candidate = readPath(body, path);
    if (candidate === undefined) continue;

    if (!isValidValue(candidate, validator)) {
      rejectedPaths.push(path);
      continue;
    }

    updates[`preferences.${path}`] = candidate;
    acceptedPaths.push(path);
  }

  const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key));
  if (unknownKeys.length > 0 || rejectedPaths.length > 0) {
    logger.warn('preferences_update_skipped_keys', {
      userId: String(req.user._id),
      unknownKeys,
      rejectedPaths,
    });
  }

  if (Object.keys(updates).length === 0) {
    const prefs = req.user.preferences as { toObject?: () => Record<string, unknown> } | undefined;
    const current = prefs?.toObject ? prefs.toObject() : prefs ?? {};
    res.json({ success: true, data: { preferences: current, updated: [] } });
    return;
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true, context: 'query' }
  ).select('preferences');

  if (!updated) throw httpError(404, 'User not found');

  const updatedPrefs = updated.preferences as { toObject?: () => Record<string, unknown> } | undefined;
  const preferences = updatedPrefs?.toObject ? updatedPrefs.toObject() : updatedPrefs ?? {};

  res.json({ success: true, data: { preferences, updated: acceptedPaths } });
});

export const becomeCreator: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  if (req.user.role === 'viewer') {
    req.user.role = 'creator';
    await req.user.save();
    logger.info('role_promoted_to_creator', { userId: String(req.user._id) });
  }

  res.json({ success: true, data: { user: serializeUser(req.user) } });
});
