import type { RequestHandler } from 'express';
import type { Types } from 'mongoose';

import Video, { type VideoDoc } from '../models/Video.js';
import Like from '../models/Like.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { ReactionValue } from '@shared/constants/enums.js';

const VIDEO_PROJECTION = '_id likeCount dislikeCount status';

const parseReactionValue = (raw: unknown): ReactionValue | null => {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (n === 1 || n === -1) return n;
  return null;
};

const counterField = (value: ReactionValue): 'likeCount' | 'dislikeCount' =>
  value === 1 ? 'likeCount' : 'dislikeCount';

interface VideoCountersLike {
  videoId?: string;
  likeCount: number;
  dislikeCount: number;
}

const buildPayload = (videoDoc: VideoCountersLike, myValue: 0 | 1 | -1) => ({
  videoId: videoDoc.videoId ?? undefined,
  likeCount: videoDoc.likeCount,
  dislikeCount: videoDoc.dislikeCount,
  myReaction: myValue,
});

const adjustCounters = async (
  videoId: Types.ObjectId,
  decField: 'likeCount' | 'dislikeCount' | null,
  incField: 'likeCount' | 'dislikeCount' | null
) => {
  const update: Record<string, Record<string, number>> = {};
  if (decField) update.$inc = { ...(update.$inc ?? {}), [decField]: -1 };
  if (incField) update.$inc = { ...(update.$inc ?? {}), [incField]: 1 };

  const filter: Record<string, unknown> = { _id: videoId };
  if (decField) filter[decField] = { $gt: 0 };

  return Video.findOneAndUpdate(filter, update, {
    new: true,
    projection: VIDEO_PROJECTION,
  }).lean();
};

const findReadyVideo = async (videoId: string) => {
  const video = await Video.findOne({ videoId, status: 'ready' })
    .select(`${VIDEO_PROJECTION} videoId`)
    .lean();
  if (!video) throw httpError(404, 'Video not found');
  return video;
};

export const setReaction: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const value = parseReactionValue((req.body as { value?: unknown })?.value);
  if (value === null) {
    throw httpError(400, 'Reaction value must be 1 (like) or -1 (dislike)');
  }

  const video = await findReadyVideo(String(req.params.videoId));
  const userId = req.user._id;

  const existing = await Like.findOne({ user: userId, video: video._id });

  if (existing && existing.value === value) {
    await existing.deleteOne();
    const updated = await adjustCounters(video._id, counterField(value), null);
    res.json({
      success: true,
      data: buildPayload({ ...video, ...(updated ?? {}) } as VideoCountersLike, 0),
    });
    return;
  }

  if (existing) {
    const previousValue = existing.value;
    existing.value = value;
    await existing.save();
    const updated = await adjustCounters(
      video._id,
      counterField(previousValue),
      counterField(value)
    );
    res.json({
      success: true,
      data: buildPayload({ ...video, ...(updated ?? {}) } as VideoCountersLike, value),
    });
    return;
  }

  try {
    await Like.create({ user: userId, video: video._id, value });
  } catch (err) {
    const candidate = err as { code?: number };
    if (candidate?.code !== 11000) throw err;
    logger.warn('like_race_duplicate_key', {
      userId: String(userId),
      videoId: req.params.videoId,
    });
  }

  const updated = await adjustCounters(video._id, null, counterField(value));
  res.json({
    success: true,
    data: buildPayload({ ...video, ...(updated ?? {}) } as VideoCountersLike, value),
  });
});

export const removeReaction: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const video = await findReadyVideo(String(req.params.videoId));
  const userId = req.user._id;

  const existing = await Like.findOneAndDelete({ user: userId, video: video._id });
  if (!existing) {
    res.json({ success: true, data: buildPayload(video as VideoCountersLike, 0) });
    return;
  }

  const updated = await adjustCounters(video._id, counterField(existing.value), null);
  res.json({
    success: true,
    data: buildPayload({ ...video, ...(updated ?? {}) } as VideoCountersLike, 0),
  });
});

export const getMyReaction: RequestHandler = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ videoId: req.params.videoId })
    .select('_id likeCount dislikeCount status visibility')
    .lean();
  if (!video) throw httpError(404, 'Video not found');

  let value: 0 | 1 | -1 = 0;
  if (req.user) {
    const reaction = await Like.findOne({ user: req.user._id, video: video._id })
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
});
