import User from '../models/User.js';
import { logger } from '../utils/logger.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

// Whitelisted shape returned to anonymous and authenticated callers alike.
// Keeping this list explicit (rather than relying on toJSON transforms) is the
// last line of defense against accidentally leaking `email`, `password`,
// `preferences`, `isBanned`, or `lastLoginAt` through the public profile API.
const PROFILE_PROJECTION =
  'username displayName bio avatarUrl bannerUrl subscriberCount videoCount totalViews createdAt';

// Authoritative whitelist of preference paths a user may mutate. Any key that
// isn't listed here is silently dropped (logged for observability) — this is
// the mass-assignment guard for the preferences subdocument.
const PREFERENCE_VALIDATORS = {
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
  Object.keys(PREFERENCE_VALIDATORS).map((path) => path.split('.')[0])
);

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const serializePublicProfile = (user) => ({
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

const serializeUser = (userDoc) => {
  const user = userDoc.toJSON ? userDoc.toJSON() : userDoc;
  delete user.password;
  return user;
};

// Walks an arbitrary input object and resolves a dot-notation path. Returns
// `undefined` when any segment is missing — distinct from `null`, which is a
// caller-supplied value that should be rejected by the validators.
const readPath = (source, dottedPath) => {
  const segments = dottedPath.split('.');
  let cursor = source;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
};

const isValidValue = (value, validator) => {
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

export const getPublicProfile = async (req, res, next) => {
  try {
    const raw = req.params.username;
    if (typeof raw !== 'string' || !USERNAME_REGEX.test(raw)) {
      throw httpError(400, 'Invalid username');
    }

    const user = await User.findOne({ username: raw.toLowerCase() })
      .select(`${PROFILE_PROJECTION} isBanned`)
      .lean();

    // Treat banned accounts as if they did not exist for the public surface so
    // moderation actions don't leak through the channel profile endpoint.
    if (!user || user.isBanned) {
      throw httpError(404, 'Channel not found');
    }

    res.json({ success: true, data: serializePublicProfile(user) });
  } catch (err) {
    next(err);
  }
};

export const getPreferences = async (req, res, next) => {
  try {
    // `req.user` is the live mongoose document loaded by `protect`; pulling
    // preferences from there avoids an extra round-trip and guarantees the
    // shape matches the schema defaults applied at write time.
    const preferences = req.user.preferences?.toObject
      ? req.user.preferences.toObject()
      : req.user.preferences ?? {};

    res.json({ success: true, data: { preferences } });
  } catch (err) {
    next(err);
  }
};

export const updatePreferences = async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const updates = {};
    const acceptedPaths = [];
    const rejectedPaths = [];

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

    // Top-level keys that aren't part of the schema are dropped silently per
    // the spec — log them so we can spot client bugs without leaking the
    // failure to the caller.
    const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_TOP_LEVEL_KEYS.has(key));
    if (unknownKeys.length > 0 || rejectedPaths.length > 0) {
      logger.warn('preferences_update_skipped_keys', {
        userId: String(req.user._id),
        unknownKeys,
        rejectedPaths,
      });
    }

    if (Object.keys(updates).length === 0) {
      const current = req.user.preferences?.toObject
        ? req.user.preferences.toObject()
        : req.user.preferences ?? {};
      return res.json({
        success: true,
        data: { preferences: current, updated: [] },
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true, context: 'query' }
    ).select('preferences');

    if (!updated) throw httpError(404, 'User not found');

    const preferences = updated.preferences?.toObject
      ? updated.preferences.toObject()
      : updated.preferences ?? {};

    res.json({
      success: true,
      data: { preferences, updated: acceptedPaths },
    });
  } catch (err) {
    next(err);
  }
};

export const becomeCreator = async (req, res, next) => {
  try {
    if (req.user.role === 'viewer') {
      req.user.role = 'creator';
      await req.user.save();
      logger.info('role_promoted_to_creator', { userId: String(req.user._id) });
    }

    // Already creator/admin → idempotent no-op. Demotion is intentionally NOT
    // exposed here; only the admin moderation API may downgrade roles.
    res.json({ success: true, data: { user: serializeUser(req.user) } });
  } catch (err) {
    next(err);
  }
};
