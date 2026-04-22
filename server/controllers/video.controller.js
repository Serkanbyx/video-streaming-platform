import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import mongoose from 'mongoose';

import { env } from '../config/env.js';
import Video from '../models/Video.js';
import User from '../models/User.js';
import { pickFields } from '../utils/pickFields.js';
import { serializeVideo, serializeVideos } from '../utils/videoSerializer.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GENERIC_FAILURE_MESSAGE = 'Processing failed';

const PUBLIC_FILTER = { status: 'ready', visibility: 'public' };

const AUTHOR_PROJECTION = 'username displayName subscriberCount avatarUrl';

const UPDATABLE_FIELDS = ['title', 'description', 'tags', 'visibility'];

const SORT_PRESETS = {
  new: { createdAt: -1 },
  top: { views: -1 },
  liked: { likeCount: -1 },
};
const SORT_KEYS = Object.keys(SORT_PRESETS);

const MAX_PAGE_SIZE = 48;
const DEFAULT_PAGE_SIZE = 12;

const RECOMMENDATIONS_DEFAULT_LIMIT = 8;
const RECOMMENDATIONS_MAX_LIMIT = 24;

// Hard caps on free-text query inputs. Defense-in-depth against ReDoS and
// `$text` blow-up: even though we never compile user input into a RegExp,
// keeping payloads small bounds worst-case CPU/IO per request.
const MAX_Q_LENGTH = 100;
const MAX_TAG_LENGTH = 32;

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const clampPage = (raw) => {
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const clampLimit = (raw) => {
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, parsed);
};

const isValidSortKey = (key) =>
  typeof key === 'string' && SORT_KEYS.includes(key);

const resolveSort = (key) =>
  isValidSortKey(key) ? SORT_PRESETS[key] : SORT_PRESETS.new;

const parseSearchQuery = (raw) => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_Q_LENGTH) {
    throw httpError(400, `Search query must be at most ${MAX_Q_LENGTH} characters`);
  }
  return trimmed;
};

const parseTagFilter = (raw) => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_TAG_LENGTH) {
    throw httpError(400, `Tag must be at most ${MAX_TAG_LENGTH} characters`);
  }
  return trimmed.toLowerCase();
};

const validateSortParam = (raw) => {
  if (raw === undefined || raw === '') return null;
  if (!isValidSortKey(raw)) {
    throw httpError(400, `Invalid sort key. Allowed: ${SORT_KEYS.join(', ')}`);
  }
  return raw;
};

/**
 * Cascade-delete dependent documents using raw collections so this controller
 * does not depend on Comment/Like/View models being registered yet.
 */
const cascadeDeleteRelated = async (videoObjectId) => {
  const db = mongoose.connection?.db;
  if (!db) return;
  const targets = ['comments', 'likes', 'views'];
  await Promise.all(
    targets.map((collectionName) =>
      db
        .collection(collectionName)
        .deleteMany({ video: videoObjectId })
        .catch((err) => {
          logger.warn('cascade_delete_failed', {
            collection: collectionName,
            errorMessage: err.message,
          });
        })
    )
  );
};

const removeProcessedFolder = async (videoId) => {
  const target = path.resolve(__dirname, '..', env.UPLOAD_DIR_PROCESSED, String(videoId));
  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch (err) {
    logger.warn('cleanup_processed_failed', {
      videoId: String(videoId),
      errorMessage: err.message,
    });
  }
};

const isOwnerOrAdmin = (req, video) => {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return req.user._id.equals(video.author?._id ?? video.author);
};

export const getStatus = async (req, res, next) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId })
      .select('videoId status processingError author')
      .lean();

    if (!video) throw httpError(404, 'Video not found');

    const viewer = req.user;
    const isAuthor = viewer && String(video.author) === String(viewer._id);
    const isAdmin = viewer?.role === 'admin';

    let processingError = null;
    if (video.status === 'failed') {
      processingError =
        isAuthor || isAdmin
          ? video.processingError || GENERIC_FAILURE_MESSAGE
          : GENERIC_FAILURE_MESSAGE;
    }

    res.json({
      success: true,
      data: {
        videoId: video.videoId,
        status: video.status,
        processingError,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listVideos = async (req, res, next) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const q = parseSearchQuery(req.query.q);
    const tag = parseTagFilter(req.query.tag);
    const explicitSort = validateSortParam(req.query.sort);

    const filter = { ...PUBLIC_FILTER };
    let projection;
    let sort = resolveSort(explicitSort);

    if (q) {
      filter.$text = { $search: q };
      projection = { score: { $meta: 'textScore' } };
      if (!explicitSort) {
        sort = { score: { $meta: 'textScore' }, createdAt: -1 };
      }
    }

    if (tag) {
      filter.tags = tag;
    }

    const [items, total] = await Promise.all([
      Video.find(filter, projection)
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
  } catch (err) {
    next(err);
  }
};

export const getVideoById = async (req, res, next) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId })
      .populate('author', AUTHOR_PROJECTION)
      .lean();

    if (!video) throw httpError(404, 'Video not found');

    const isPublicReady =
      video.status === 'ready' && video.visibility === 'public';

    if (!isPublicReady) {
      const viewer = req.user;
      const isAuthor =
        viewer && String(video.author?._id ?? video.author) === String(viewer._id);
      const isAdmin = viewer?.role === 'admin';
      if (!isAuthor && !isAdmin) throw httpError(404, 'Video not found');
    }

    res.json({ success: true, data: serializeVideo(video) });
  } catch (err) {
    next(err);
  }
};

export const getMyVideos = async (req, res, next) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter = { author: req.user._id };

    const [items, total] = await Promise.all([
      Video.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Video.countDocuments(filter),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      success: true,
      data: { items: serializeVideos(items), page, totalPages, total, limit },
    });
  } catch (err) {
    next(err);
  }
};

export const updateVideo = async (req, res, next) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId });
    if (!video) throw httpError(404, 'Video not found');

    if (!isOwnerOrAdmin(req, video)) throw httpError(403, 'Forbidden');

    const updates = pickFields(req.body, UPDATABLE_FIELDS);
    Object.assign(video, updates);
    await video.save();

    res.json({ success: true, data: serializeVideo(video) });
  } catch (err) {
    next(err);
  }
};

export const deleteVideo = async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
};

/**
 * Basic recommendation strategy described in STEPS.md §15:
 *   1. Half of the slots → most recent OTHER ready+public videos by the same
 *      author (encourages binge-watching one creator).
 *   2. Remaining slots → newest ready+public videos overall, excluding the
 *      current video and anything already pulled in step 1 (graceful fallback
 *      when the author has no other content yet).
 *
 * Both queries run in parallel; we deduplicate by `_id` before slicing so a
 * video that qualifies for both buckets is never returned twice.
 */
export const getRecommendations = async (req, res, next) => {
  try {
    const limit = Math.min(
      RECOMMENDATIONS_MAX_LIMIT,
      Math.max(
        1,
        parseInt(req.query.limit, 10) || RECOMMENDATIONS_DEFAULT_LIMIT
      )
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

    const [sameAuthor, globalNew] = await Promise.all([
      current.author
        ? Video.find(sameAuthorFilter)
            .sort({ createdAt: -1 })
            .limit(half)
            .populate('author', AUTHOR_PROJECTION)
            .lean()
        : Promise.resolve([]),
      Video.find({ ...PUBLIC_FILTER, _id: { $ne: current._id } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('author', AUTHOR_PROJECTION)
        .lean(),
    ]);

    const seen = new Set(sameAuthor.map((v) => String(v._id)));
    const fillers = globalNew
      .filter((v) => !seen.has(String(v._id)))
      .slice(0, limit - sameAuthor.length);

    const items = [...sameAuthor, ...fillers].slice(0, limit);

    res.json({
      success: true,
      data: { items: serializeVideos(items), limit },
    });
  } catch (err) {
    next(err);
  }
};

export const getByChannel = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
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
  } catch (err) {
    next(err);
  }
};
