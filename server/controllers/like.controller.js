import Video from '../models/Video.js';
import Like from '../models/Like.js';
import { logger } from '../utils/logger.js';

const VIDEO_PROJECTION = '_id likeCount dislikeCount status';

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const parseReactionValue = (raw) => {
  // Accept literal numbers and numeric strings; everything else is rejected.
  // Strict equality against [1, -1] keeps the surface area minimal and aligns
  // with the unique-constrained schema enum.
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (n === 1 || n === -1) return n;
  return null;
};

const counterField = (value) => (value === 1 ? 'likeCount' : 'dislikeCount');

const buildPayload = (videoDoc, myValue) => ({
  videoId: videoDoc.videoId ?? undefined,
  likeCount: videoDoc.likeCount,
  dislikeCount: videoDoc.dislikeCount,
  myReaction: myValue,
});

/**
 * Atomic-ish counter sync. We accept eventual consistency (see STEPS.md §13)
 * and rely on a future `recountLikes()` job to repair drift caused by races
 * between the find/decision step and the $inc step.
 */
const adjustCounters = async (videoId, decField, incField) => {
  const update = {};
  if (decField) update.$inc = { ...(update.$inc ?? {}), [decField]: -1 };
  if (incField) update.$inc = { ...(update.$inc ?? {}), [incField]: 1 };

  // `min` clamp on schema (`min: 0`) prevents negatives from being persisted,
  // but we still avoid issuing decrements when the counter is already at 0
  // to keep the document consistent with the underlying Like collection.
  const filter = { _id: videoId };
  if (decField) filter[decField] = { $gt: 0 };

  return Video.findOneAndUpdate(filter, update, {
    new: true,
    projection: VIDEO_PROJECTION,
  }).lean();
};

const findReadyVideo = async (videoId) => {
  const video = await Video.findOne({ videoId, status: 'ready' })
    .select(VIDEO_PROJECTION + ' videoId')
    .lean();
  if (!video) throw httpError(404, 'Video not found');
  return video;
};

export const setReaction = async (req, res, next) => {
  try {
    const value = parseReactionValue(req.body?.value);
    if (value === null) {
      throw httpError(400, 'Reaction value must be 1 (like) or -1 (dislike)');
    }

    const video = await findReadyVideo(req.params.videoId);
    const userId = req.user._id;

    const existing = await Like.findOne({ user: userId, video: video._id });

    // Toggle off: same reaction → delete it and decrement that counter.
    if (existing && existing.value === value) {
      await existing.deleteOne();
      const updated = await adjustCounters(video._id, counterField(value), null);
      return res.json({
        success: true,
        data: buildPayload(
          { ...video, ...(updated ?? {}) },
          0
        ),
      });
    }

    // Switch reaction: opposite value → flip and rebalance both counters.
    if (existing) {
      const previousValue = existing.value;
      existing.value = value;
      await existing.save();
      const updated = await adjustCounters(
        video._id,
        counterField(previousValue),
        counterField(value)
      );
      return res.json({
        success: true,
        data: buildPayload({ ...video, ...(updated ?? {}) }, value),
      });
    }

    // Fresh reaction: insert and increment.
    try {
      await Like.create({ user: userId, video: video._id, value });
    } catch (err) {
      // Race: a concurrent request inserted the same (user, video) pair
      // between our findOne and create. Treat as a no-op success and re-read
      // so the client sees a consistent state.
      if (err?.code !== 11000) throw err;
      logger.warn('like_race_duplicate_key', {
        userId: String(userId),
        videoId: req.params.videoId,
      });
    }

    const updated = await adjustCounters(video._id, null, counterField(value));
    return res.json({
      success: true,
      data: buildPayload({ ...video, ...(updated ?? {}) }, value),
    });
  } catch (err) {
    next(err);
  }
};

export const removeReaction = async (req, res, next) => {
  try {
    const video = await findReadyVideo(req.params.videoId);
    const userId = req.user._id;

    const existing = await Like.findOneAndDelete({
      user: userId,
      video: video._id,
    });

    if (!existing) {
      return res.json({
        success: true,
        data: buildPayload(video, 0),
      });
    }

    const updated = await adjustCounters(
      video._id,
      counterField(existing.value),
      null
    );

    res.json({
      success: true,
      data: buildPayload({ ...video, ...(updated ?? {}) }, 0),
    });
  } catch (err) {
    next(err);
  }
};

export const getMyReaction = async (req, res, next) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId })
      .select('_id likeCount dislikeCount status visibility')
      .lean();

    if (!video) throw httpError(404, 'Video not found');

    let value = 0;
    if (req.user) {
      const reaction = await Like.findOne({
        user: req.user._id,
        video: video._id,
      })
        .select('value')
        .lean();
      if (reaction) value = reaction.value;
    }

    res.json({
      success: true,
      data: {
        videoId: req.params.videoId,
        likeCount: video.likeCount,
        dislikeCount: video.dislikeCount,
        myReaction: value,
      },
    });
  } catch (err) {
    next(err);
  }
};
