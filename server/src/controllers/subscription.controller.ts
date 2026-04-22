import type { RequestHandler } from 'express';
import mongoose from 'mongoose';

import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import Video from '../models/Video.js';
import { serializeVideos } from '../utils/videoSerializer.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const CHANNEL_PROJECTION =
  'username displayName avatarUrl bannerUrl subscriberCount videoCount';
const AUTHOR_PROJECTION = 'username displayName subscriberCount avatarUrl';
const PUBLIC_VIDEO_FILTER = { status: 'ready' as const, visibility: 'public' as const };

const MAX_PAGE_SIZE = 48;
const DEFAULT_FEED_LIMIT = 24;
const DEFAULT_LIST_LIMIT = 24;

const clampPage = (raw: unknown): number => {
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const clampLimit = (raw: unknown, fallback: number): number => {
  const parsed = parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_PAGE_SIZE, parsed);
};

const ensureValidChannelId = (raw: unknown): mongoose.Types.ObjectId => {
  if (!mongoose.isValidObjectId(raw)) throw httpError(400, 'Invalid channel id');
  return new mongoose.Types.ObjectId(String(raw));
};

const findExistingChannel = async (channelId: mongoose.Types.ObjectId) => {
  const channel = await User.findById(channelId)
    .select('_id username subscriberCount isBanned')
    .lean();
  if (!channel || channel.isBanned) throw httpError(404, 'Channel not found');
  return channel;
};

export const subscribe: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const channelId = ensureValidChannelId(req.params.channelId);

  if (req.user._id.equals(channelId)) {
    throw httpError(400, 'You cannot subscribe to yourself');
  }

  const channel = await findExistingChannel(channelId);

  let created = false;
  try {
    await Subscription.create({ subscriber: req.user._id, channel: channel._id });
    created = true;
  } catch (err) {
    const candidate = err as { code?: number };
    if (candidate?.code !== 11000) throw err;
    logger.warn('subscribe_race_duplicate_key', {
      subscriberId: String(req.user._id),
      channelId: String(channel._id),
    });
  }

  let subscriberCount = channel.subscriberCount;
  if (created) {
    const updated = await User.findByIdAndUpdate(
      channel._id,
      { $inc: { subscriberCount: 1 } },
      { new: true, projection: 'subscriberCount' }
    ).lean();
    subscriberCount = updated?.subscriberCount ?? subscriberCount + 1;
  }

  res.status(created ? 201 : 200).json({
    success: true,
    data: {
      channelId: String(channel._id),
      isSubscribed: true,
      subscriberCount,
    },
  });
});

export const unsubscribe: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const channelId = ensureValidChannelId(req.params.channelId);
  const channel = await findExistingChannel(channelId);

  const removed = await Subscription.findOneAndDelete({
    subscriber: req.user._id,
    channel: channel._id,
  });

  let subscriberCount = channel.subscriberCount;
  if (removed) {
    const updated = await User.findOneAndUpdate(
      { _id: channel._id, subscriberCount: { $gt: 0 } },
      { $inc: { subscriberCount: -1 } },
      { new: true, projection: 'subscriberCount' }
    ).lean();
    subscriberCount = updated?.subscriberCount ?? subscriberCount;
  }

  res.json({
    success: true,
    data: {
      channelId: String(channel._id),
      isSubscribed: false,
      subscriberCount,
    },
  });
});

export const myChannels: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, DEFAULT_LIST_LIMIT);
  const skip = (page - 1) * limit;

  const filter = { subscriber: req.user._id };

  const [items, total] = await Promise.all([
    Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('channel', CHANNEL_PROJECTION)
      .lean(),
    Subscription.countDocuments(filter),
  ]);

  const channels = items
    .filter((sub) => sub.channel)
    .map((sub) => ({ subscribedAt: sub.createdAt, channel: sub.channel }));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: { items: channels, page, totalPages, total, limit },
  });
});

export const subscriptionFeed: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit, DEFAULT_FEED_LIMIT);
  const skip = (page - 1) * limit;

  const channelIds = await Subscription.find({ subscriber: req.user._id })
    .select('channel')
    .lean();

  if (channelIds.length === 0) {
    res.json({
      success: true,
      data: { items: [], page: 1, totalPages: 1, total: 0, limit },
    });
    return;
  }

  const authorFilter = { $in: channelIds.map((sub) => sub.channel) };
  const filter = { ...PUBLIC_VIDEO_FILTER, author: authorFilter };

  const [items, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_PROJECTION)
      .lean(),
    Video.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: { items: serializeVideos(items), page, totalPages, total, limit },
  });
});

export const isSubscribed: RequestHandler = asyncHandler(async (req, res) => {
  const channelId = ensureValidChannelId(req.params.channelId);

  const channel = await User.findById(channelId)
    .select('_id subscriberCount isBanned')
    .lean();
  if (!channel || channel.isBanned) throw httpError(404, 'Channel not found');

  let subscribed = false;
  if (req.user) {
    const exists = await Subscription.exists({
      subscriber: req.user._id,
      channel: channel._id,
    });
    subscribed = !!exists;
  }

  res.json({
    success: true,
    data: {
      channelId: String(channel._id),
      isSubscribed: subscribed,
      subscriberCount: channel.subscriberCount,
    },
  });
});
