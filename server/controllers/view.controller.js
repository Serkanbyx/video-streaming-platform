import Video from '../models/Video.js';
import User from '../models/User.js';
import View from '../models/View.js';
import { serializeVideo } from '../utils/videoSerializer.js';
import { logger } from '../utils/logger.js';

const DEDUP_WINDOW_MS = 30 * 60 * 1000;
const HISTORY_LIMIT = 50;
const AUTHOR_PROJECTION = 'username displayName subscriberCount avatarUrl';

// Accepts both UUID v1-v5 and the simpler v4 shape produced by `crypto.randomUUID()`.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isValidFingerprint = (value) =>
  typeof value === 'string' && UUID_REGEX.test(value.trim());

export const recordView = async (req, res, next) => {
  try {
    const video = await Video.findOne({
      videoId: req.params.videoId,
      status: 'ready',
      visibility: 'public',
    }).select('_id author views');

    if (!video) throw httpError(404, 'Video not found');

    const userId = req.user?._id ?? null;
    const fingerprintRaw = typeof req.body?.fingerprint === 'string'
      ? req.body.fingerprint.trim()
      : null;

    // Authenticated users still pass a fingerprint (for cross-device dedup
    // hygiene) but we must never accept a request without *some* identity.
    if (!userId && !isValidFingerprint(fingerprintRaw)) {
      throw httpError(400, 'A valid fingerprint is required for anonymous views');
    }

    const fingerprint = isValidFingerprint(fingerprintRaw) ? fingerprintRaw : null;

    const dedupQuery = userId
      ? { video: video._id, user: userId }
      : { video: video._id, fingerprint, user: null };

    const since = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recent = await View.findOne({
      ...dedupQuery,
      createdAt: { $gte: since },
    })
      .select('_id')
      .lean();

    if (recent) {
      return res.json({
        success: true,
        data: { counted: false, views: video.views },
      });
    }

    await View.create({
      video: video._id,
      user: userId,
      // Schema requires fingerprint; for authed users without one we fall back
      // to a stable per-user marker so dedup-by-user still works while keeping
      // the field non-empty.
      fingerprint: fingerprint || `user:${userId}`,
    });

    const updated = await Video.findByIdAndUpdate(
      video._id,
      { $inc: { views: 1 } },
      { new: true, projection: 'views' }
    ).lean();

    if (video.author) {
      User.findByIdAndUpdate(video.author, { $inc: { totalViews: 1 } })
        .catch((err) => {
          logger.warn('author_total_views_increment_failed', {
            videoId: req.params.videoId,
            errorMessage: err.message,
          });
        });
    }

    res.json({
      success: true,
      data: { counted: true, views: updated?.views ?? video.views + 1 },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const aggregated = await View.aggregate([
      { $match: { user: userId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$video',
          viewedAt: { $first: '$createdAt' },
        },
      },
      { $sort: { viewedAt: -1 } },
      { $limit: HISTORY_LIMIT },
      {
        $lookup: {
          from: 'videos',
          localField: '_id',
          foreignField: '_id',
          as: 'video',
        },
      },
      { $unwind: '$video' },
      // Drop entries whose underlying video was deleted, made private, or is
      // still processing — history should only surface playable content.
      { $match: { 'video.status': 'ready', 'video.visibility': 'public' } },
    ]);

    const videoIds = aggregated.map((entry) => entry._id);
    const populated = await Video.find({ _id: { $in: videoIds } })
      .populate('author', AUTHOR_PROJECTION)
      .lean();

    const byId = new Map(populated.map((v) => [String(v._id), v]));
    const items = aggregated
      .map((entry) => {
        const video = byId.get(String(entry._id));
        if (!video) return null;
        return {
          viewedAt: entry.viewedAt,
          video: serializeVideo(video),
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      data: { items, total: items.length, limit: HISTORY_LIMIT },
    });
  } catch (err) {
    next(err);
  }
};
