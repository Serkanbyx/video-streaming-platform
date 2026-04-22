import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { RequestHandler } from 'express';
import mongoose, { type Types } from 'mongoose';

import { env } from '../config/env.js';
import Video, { type VideoDoc } from '../models/Video.js';
import User from '../models/User.js';
import { serializeVideo, serializeVideos } from '../utils/videoSerializer.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pickFields } from '../utils/pickFields.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GENERIC_FAILURE_MESSAGE = 'Processing failed';
const PUBLIC_FILTER = { status: 'ready' as const, visibility: 'public' as const };
const AUTHOR_PROJECTION = 'username displayName subscriberCount avatarUrl';
const UPDATABLE_FIELDS = ['title', 'description', 'tags', 'visibility'] as const;

const SORT_PRESETS: Record<string, Record<string, 1 | -1>> = {
  new: { createdAt: -1 },
  top: { views: -1 },
  liked: { likeCount: -1 },
};
const SORT_KEYS = Object.keys(SORT_PRESETS);

const MAX_PAGE_SIZE = 48;
const DEFAULT_PAGE_SIZE = 12;
const RECOMMENDATIONS_DEFAULT_LIMIT = 8;
const RECOMMENDATIONS_MAX_LIMIT = 24;
const MAX_Q_LENGTH = 100;
const MAX_TAG_LENGTH = 32;

const clampPage = (raw: unknown): number => {
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const clampLimit = (raw: unknown): number => {
  const parsed = parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, parsed);
};

const isValidSortKey = (key: unknown): key is string =>
  typeof key === 'string' && SORT_KEYS.includes(key);

const resolveSort = (key: unknown): Record<string, 1 | -1> =>
  isValidSortKey(key) && SORT_PRESETS[key] ? SORT_PRESETS[key]! : SORT_PRESETS.new!;

const parseSearchQuery = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_Q_LENGTH) {
    throw httpError(400, `Search query must be at most ${MAX_Q_LENGTH} characters`);
  }
  return trimmed;
};

const parseTagFilter = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_TAG_LENGTH) {
    throw httpError(400, `Tag must be at most ${MAX_TAG_LENGTH} characters`);
  }
  return trimmed.toLowerCase();
};

const validateSortParam = (raw: unknown): string | null => {
  if (raw === undefined || raw === '') return null;
  if (!isValidSortKey(raw)) {
    throw httpError(400, `Invalid sort key. Allowed: ${SORT_KEYS.join(', ')}`);
  }
  return raw;
};

const cascadeDeleteRelated = async (videoObjectId: Types.ObjectId): Promise<void> => {
  const db = mongoose.connection?.db;
  if (!db) return;
  const targets = ['comments', 'likes', 'views'];
  await Promise.all(
    targets.map((collectionName) =>
      db
        .collection(collectionName)
        .deleteMany({ video: videoObjectId })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn('cascade_delete_failed', { collection: collectionName, errorMessage: message });
        })
    )
  );
};

const removeProcessedFolder = async (videoId: string): Promise<void> => {
  const target = path.resolve(__dirname, '..', '..', env.UPLOAD_DIR_PROCESSED, String(videoId));
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('cleanup_processed_failed', { videoId: String(videoId), errorMessage: message });
  }
};

const isOwnerOrAdmin = (req: Parameters<RequestHandler>[0], video: VideoDoc | { author: unknown }): boolean => {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  const authorId = (video.author as { _id?: unknown })?._id ?? video.author;
  return req.user._id.equals(authorId as Types.ObjectId | string);
};

export const getStatus: RequestHandler = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ videoId: req.params.videoId })
    .select('videoId status processingError author')
    .lean();
  if (!video) throw httpError(404, 'Video not found');

  const viewer = req.user;
  const isAuthor = viewer && String(video.author) === String(viewer._id);
  const isAdmin = viewer?.role === 'admin';

  let processingError: string | null = null;
  if (video.status === 'failed') {
    processingError =
      isAuthor || isAdmin
        ? video.processingError || GENERIC_FAILURE_MESSAGE
        : GENERIC_FAILURE_MESSAGE;
  }

  res.json({
    success: true,
    data: { videoId: video.videoId, status: video.status, processingError },
  });
});

export const listVideos: RequestHandler = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const q = parseSearchQuery(req.query.q);
  const tag = parseTagFilter(req.query.tag);
  const explicitSort = validateSortParam(req.query.sort);

  const filter: Record<string, unknown> = { ...PUBLIC_FILTER };
  let projection: Record<string, unknown> | undefined;
  let sort: Record<string, unknown> = resolveSort(explicitSort);

  if (q) {
    filter.$text = { $search: q };
    projection = { score: { $meta: 'textScore' } };
    if (!explicitSort) sort = { score: { $meta: 'textScore' }, createdAt: -1 };
  }
  if (tag) filter.tags = tag;

  const [items, total] = await Promise.all([
    Video.find(filter, projection as mongoose.ProjectionType<VideoDoc> | null | undefined)
      .sort(sort as Record<string, 1 | -1>)
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

export const getVideoById: RequestHandler = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ videoId: req.params.videoId })
    .populate('author', AUTHOR_PROJECTION)
    .lean();
  if (!video) throw httpError(404, 'Video not found');

  const isPublicReady = video.status === 'ready' && video.visibility === 'public';

  if (!isPublicReady) {
    const viewer = req.user;
    const authorRef = video.author as { _id?: unknown } | string | undefined;
    const authorId = (authorRef as { _id?: unknown })?._id ?? authorRef;
    const isAuthor = viewer && String(authorId) === String(viewer._id);
    const isAdmin = viewer?.role === 'admin';
    if (!isAuthor && !isAdmin) throw httpError(404, 'Video not found');
  }

  res.json({ success: true, data: serializeVideo(video) });
});

export const getMyVideos: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');

  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const filter = { author: req.user._id };

  const [items, total] = await Promise.all([
    Video.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Video.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: { items: serializeVideos(items), page, totalPages, total, limit },
  });
});

export const updateVideo: RequestHandler = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ videoId: req.params.videoId });
  if (!video) throw httpError(404, 'Video not found');

  if (!isOwnerOrAdmin(req, video)) throw httpError(403, 'Forbidden');

  const updates = pickFields(req.body as Record<string, unknown>, UPDATABLE_FIELDS);
  Object.assign(video, updates);
  await video.save();

  res.json({ success: true, data: serializeVideo(video) });
});

export const deleteVideo: RequestHandler = asyncHandler(async (req, res) => {
  const video = await Video.findOne({ videoId: req.params.videoId });
  if (!video) throw httpError(404, 'Video not found');

  if (!isOwnerOrAdmin(req, video)) throw httpError(403, 'Forbidden');

  const { _id: videoObjectId, videoId, author } = video;

  await video.deleteOne();
  await cascadeDeleteRelated(videoObjectId);
  await removeProcessedFolder(videoId);

  await User.updateOne(
    { _id: author, videoCount: { $gt: 0 } },
    { $inc: { videoCount: -1 } }
  );

  res.json({ success: true, data: { videoId } });
});

export const getRecommendations: RequestHandler = asyncHandler(async (req, res) => {
  const limit = Math.min(
    RECOMMENDATIONS_MAX_LIMIT,
    Math.max(1, parseInt(String(req.query.limit), 10) || RECOMMENDATIONS_DEFAULT_LIMIT)
  );

  const current = await Video.findOne({ videoId: req.params.videoId })
    .select('_id author status visibility')
    .lean();
  if (!current) throw httpError(404, 'Video not found');

  const half = Math.ceil(limit / 2);

  const sameAuthorFilter = {
    ...PUBLIC_FILTER,
    _id: { $ne: current._id },
    author: current.author,
  };

  type LeanVideo = { _id: unknown } & Record<string, unknown>;

  const [sameAuthor, globalNew] = (await Promise.all([
    current.author
      ? Video.find(sameAuthorFilter)
          .sort({ createdAt: -1 })
          .limit(half)
          .populate('author', AUTHOR_PROJECTION)
          .lean()
      : Promise.resolve([] as unknown[]),
    Video.find({ ...PUBLIC_FILTER, _id: { $ne: current._id } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('author', AUTHOR_PROJECTION)
      .lean(),
  ])) as [LeanVideo[], LeanVideo[]];

  const seen = new Set(sameAuthor.map((v) => String(v._id)));
  const fillers = globalNew
    .filter((v) => !seen.has(String(v._id)))
    .slice(0, limit - sameAuthor.length);

  const items = [...sameAuthor, ...fillers].slice(0, limit);

  res.json({
    success: true,
    data: { items: serializeVideos(items as object[]), limit },
  });
});

export const getByChannel: RequestHandler = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw httpError(400, 'Invalid user id');
  }

  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;
  const sort = resolveSort(validateSortParam(req.query.sort));

  const filter = { ...PUBLIC_FILTER, author: userId };

  const [items, total] = await Promise.all([
    Video.find(filter)
      .sort(sort)
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
