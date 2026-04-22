import User from '../models/User.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

// Whitelisted shape returned to anonymous and authenticated callers alike.
// Keeping this list explicit (rather than relying on toJSON transforms) is the
// last line of defense against accidentally leaking `email`, `password`,
// `preferences`, `isBanned`, or `lastLoginAt` through the public profile API.
const PROFILE_PROJECTION =
  'username displayName bio avatarUrl bannerUrl subscriberCount videoCount totalViews createdAt';

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
