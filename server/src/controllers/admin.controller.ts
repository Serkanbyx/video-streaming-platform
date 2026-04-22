import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { RequestHandler } from 'express';
import mongoose, { type Types } from 'mongoose';

import { env } from '../config/env.js';
import User from '../models/User.js';
import Video from '../models/Video.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';
import Subscription from '../models/Subscription.js';
import View from '../models/View.js';
import { logger } from '../utils/logger.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { serializeVideos } from '../utils/videoSerializer.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { USER_ROLES, VIDEO_STATUSES, USER_SORT_KEYS, type UserSortKey } from '@shared/constants/enums.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_Q_LENGTH = 100;

const DASHBOARD_TOP_VIDEOS = 5;
const DASHBOARD_NEW_USER_WINDOW_DAYS = 7;

const USER_PROJECTION =
  'username email role displayName avatarUrl subscriberCount videoCount totalViews isBanned createdAt lastLoginAt';

const USER_SORT_PRESETS: Record<UserSortKey, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  username: { username: 1 },
};

const DISK_CACHE_TTL_MS = 30 * 1000;
let diskCache: { value: unknown | null; expiresAt: number } = { value: null, expiresAt: 0 };

const ALERT_THRESHOLDS = { warn: 60, critical: 80 };
const STALE_RAW_AGE_MS = 60 * 60 * 1000;
const DEFAULT_FAILED_AGE_DAYS = 7;

const clampPage = (raw: unknown): number => {
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const clampLimit = (raw: unknown, fallback = DEFAULT_PAGE_SIZE): number => {
  const parsed = parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(MAX_PAGE_SIZE, parsed);
};

const parseQ = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_Q_LENGTH) {
    throw httpError(400, `Search query must be at most ${MAX_Q_LENGTH} characters`);
  }
  return trimmed;
};

const parseBoolean = (raw: unknown, fieldName: string): boolean => {
  if (raw === true || raw === false) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw httpError(422, `${fieldName} must be a boolean`);
};

const ensureValidId = (raw: unknown, label: string): Types.ObjectId => {
  if (!mongoose.isValidObjectId(raw)) throw httpError(400, `Invalid ${label}`);
  return new mongoose.Types.ObjectId(String(raw));
};

const processedRoot = () => path.resolve(__dirname, '..', '..', env.UPLOAD_DIR_PROCESSED);
const rawRoot = () => path.resolve(__dirname, '..', '..', env.UPLOAD_DIR_RAW);

const removeProcessedFolder = async (videoId: string): Promise<boolean> => {
  const target = path.join(processedRoot(), String(videoId));
  try {
    await fs.rm(target, { recursive: true, force: true });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('admin_cleanup_processed_failed', {
      videoId: String(videoId),
      errorMessage: message,
    });
    return false;
  }
};

const folderSize = async (dirPath: string): Promise<number> => {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw err;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const child = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await folderSize(child);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(child);
          total += stat.size;
        } catch {
          /* ignore */
        }
      }
    })
  );
  return total;
};

const listSubdirectories = async (dirPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
};

const cascadeDeleteVideoData = async (videoObjectIds: Types.ObjectId[]): Promise<void> => {
  if (!videoObjectIds || videoObjectIds.length === 0) return;
  await Promise.all([
    Comment.deleteMany({ video: { $in: videoObjectIds } }),
    Like.deleteMany({ video: { $in: videoObjectIds } }),
    View.deleteMany({ video: { $in: videoObjectIds } }),
  ]);
};

const cascadeDeleteUser = async (userId: Types.ObjectId) => {
  const ownedVideos = await Video.find({ author: userId }).select('_id videoId').lean();
  const ownedIds = ownedVideos.map((v) => v._id);
  const ownedVideoIds = ownedVideos.map((v) => v.videoId);

  const outgoingSubs = await Subscription.find({ subscriber: userId }).select('channel').lean();

  await Promise.all([
    Video.deleteMany({ _id: { $in: ownedIds } }),
    cascadeDeleteVideoData(ownedIds),
    Comment.deleteMany({ author: userId }),
    Like.deleteMany({ user: userId }),
    View.deleteMany({ user: userId }),
    Subscription.deleteMany({
      $or: [{ subscriber: userId }, { channel: userId }],
    }),
  ]);

  if (outgoingSubs.length > 0) {
    await Promise.all(
      outgoingSubs.map((sub) =>
        User.updateOne(
          { _id: sub.channel, subscriberCount: { $gt: 0 } },
          { $inc: { subscriberCount: -1 } }
        )
      )
    );
  }

  await Promise.all(ownedVideoIds.map((videoId) => removeProcessedFolder(videoId)));

  return {
    videosDeleted: ownedIds.length,
    subscriptionsRevoked: outgoingSubs.length,
  };
};

// ============================================================================
// Dashboard
// ============================================================================

export const getDashboardStats: RequestHandler = asyncHandler(async (_req, res) => {
  const windowStart = new Date(Date.now() - DASHBOARD_NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalVideos,
    totalComments,
    newUsersLast7Days,
    videosByStatusAgg,
    totalViewsAgg,
    topVideosByViews,
  ] = await Promise.all([
    User.countDocuments(),
    Video.countDocuments(),
    Comment.countDocuments(),
    User.countDocuments({ createdAt: { $gte: windowStart } }),
    Video.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Video.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
    Video.find({ status: 'ready', visibility: 'public' })
      .sort({ views: -1 })
      .limit(DASHBOARD_TOP_VIDEOS)
      .populate('author', 'username displayName avatarUrl')
      .lean(),
  ]);

  const videosByStatus = VIDEO_STATUSES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  for (const row of videosByStatusAgg as Array<{ _id: string | null; count: number }>) {
    if (row._id) videosByStatus[row._id] = row.count;
  }

  res.json({
    success: true,
    data: {
      totalUsers,
      totalVideos,
      totalViews: (totalViewsAgg as Array<{ total: number }>)[0]?.total ?? 0,
      totalComments,
      newUsersLast7Days,
      videosByStatus,
      topVideosByViews: serializeVideos(topVideosByViews),
    },
  });
});

// ============================================================================
// Users
// ============================================================================

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  const q = parseQ(req.query.q);
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ username: regex }, { email: regex }];
  }

  if (req.query.role) {
    if (!USER_ROLES.includes(req.query.role as (typeof USER_ROLES)[number])) {
      throw httpError(400, `Invalid role. Allowed: ${USER_ROLES.join(', ')}`);
    }
    filter.role = req.query.role;
  }

  const sortKey =
    typeof req.query.sort === 'string' && (USER_SORT_KEYS as readonly string[]).includes(req.query.sort)
      ? (req.query.sort as UserSortKey)
      : 'newest';
  const sort = USER_SORT_PRESETS[sortKey];

  const [items, total] = await Promise.all([
    User.find(filter).select(USER_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: { items, page, totalPages, total, limit },
  });
});

export const setUserRole: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const targetId = ensureValidId(req.params.userId, 'user id');
  const newRole = (req.body as { role?: unknown })?.role;

  if (typeof newRole !== 'string' || !USER_ROLES.includes(newRole as (typeof USER_ROLES)[number])) {
    throw httpError(422, `Role must be one of: ${USER_ROLES.join(', ')}`);
  }

  if (req.user._id.equals(targetId)) {
    throw httpError(400, 'You cannot change your own role');
  }

  const target = await User.findById(targetId).select('role username');
  if (!target) throw httpError(404, 'User not found');

  if (target.role === newRole) {
    res.json({
      success: true,
      data: { _id: target._id, username: target.username, role: target.role },
    });
    return;
  }

  if (target.role === 'admin' && newRole !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) throw httpError(400, 'Cannot demote the last admin');
  }

  target.role = newRole as (typeof USER_ROLES)[number];
  await target.save();

  logger.info('admin_user_role_changed', {
    actorId: String(req.user._id),
    targetId: String(target._id),
    newRole,
  });

  res.json({
    success: true,
    data: { _id: target._id, username: target.username, role: target.role },
  });
});

export const toggleBan: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const targetId = ensureValidId(req.params.userId, 'user id');
  const isBanned = parseBoolean((req.body as { isBanned?: unknown })?.isBanned, 'isBanned');

  if (req.user._id.equals(targetId)) throw httpError(400, 'You cannot ban yourself');

  const target = await User.findById(targetId).select('isBanned username role');
  if (!target) throw httpError(404, 'User not found');

  target.isBanned = isBanned;
  await target.save();

  logger.info('admin_user_ban_toggled', {
    actorId: String(req.user._id),
    targetId: String(target._id),
    isBanned,
  });

  res.json({
    success: true,
    data: { _id: target._id, username: target.username, isBanned: target.isBanned },
  });
});

export const deleteUser: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const targetId = ensureValidId(req.params.userId, 'user id');

  if (req.user._id.equals(targetId)) throw httpError(400, 'You cannot delete yourself');

  const target = await User.findById(targetId);
  if (!target) throw httpError(404, 'User not found');

  if (target.role === 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) throw httpError(400, 'Cannot delete the last admin');
  }

  const cascade = await cascadeDeleteUser(target._id);
  await target.deleteOne();

  logger.info('admin_user_deleted', {
    actorId: String(req.user._id),
    targetId: String(target._id),
    ...cascade,
  });

  res.json({
    success: true,
    data: { _id: target._id, username: target.username, ...cascade },
  });
});

// ============================================================================
// Videos
// ============================================================================

export const listAllVideos: RequestHandler = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (req.query.status) {
    if (!VIDEO_STATUSES.includes(req.query.status as (typeof VIDEO_STATUSES)[number])) {
      throw httpError(400, `Invalid status. Allowed: ${VIDEO_STATUSES.join(', ')}`);
    }
    filter.status = req.query.status;
  }

  if (req.query.isFlagged !== undefined && req.query.isFlagged !== '') {
    filter.isFlagged = parseBoolean(req.query.isFlagged, 'isFlagged');
  }

  const q = parseQ(req.query.q);
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');

  const [items, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatarUrl role isBanned')
      .lean(),
    Video.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: { items: serializeVideos(items), page, totalPages, total, limit },
  });
});

export const flagVideo: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const isFlagged = parseBoolean((req.body as { isFlagged?: unknown })?.isFlagged, 'isFlagged');

  const video = await Video.findOneAndUpdate(
    { videoId: req.params.videoId },
    { $set: { isFlagged } },
    { new: true, projection: 'videoId isFlagged' }
  ).lean();
  if (!video) throw httpError(404, 'Video not found');

  logger.info('admin_video_flag_toggled', {
    actorId: String(req.user._id),
    videoId: video.videoId,
    isFlagged,
  });

  res.json({
    success: true,
    data: { videoId: video.videoId, isFlagged: video.isFlagged },
  });
});

export const adminDeleteVideo: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const video = await Video.findOne({ videoId: req.params.videoId });
  if (!video) throw httpError(404, 'Video not found');

  const { _id: videoObjectId, videoId, author } = video;

  await video.deleteOne();
  await cascadeDeleteVideoData([videoObjectId]);
  await removeProcessedFolder(videoId);

  if (author) {
    await User.updateOne(
      { _id: author, videoCount: { $gt: 0 } },
      { $inc: { videoCount: -1 } }
    );
  }

  logger.info('admin_video_deleted', {
    actorId: String(req.user._id),
    videoId,
  });

  res.json({ success: true, data: { videoId } });
});

// ============================================================================
// Comments
// ============================================================================

export const listAllComments: RequestHandler = asyncHandler(async (req, res) => {
  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (req.query.videoId) {
    if (mongoose.isValidObjectId(req.query.videoId)) {
      filter.video = new mongoose.Types.ObjectId(String(req.query.videoId));
    } else {
      const video = await Video.findOne({ videoId: req.query.videoId }).select('_id').lean();
      if (!video) {
        res.json({
          success: true,
          data: { items: [], page: 1, totalPages: 1, total: 0, limit },
        });
        return;
      }
      filter.video = video._id;
    }
  }

  const q = parseQ(req.query.q);
  if (q) filter.body = new RegExp(escapeRegex(q), 'i');

  const [items, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatarUrl')
      .populate('video', 'videoId title')
      .lean(),
    Comment.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: { items, page, totalPages, total, limit },
  });
});

export const adminDeleteComment: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const commentId = ensureValidId(req.params.commentId, 'comment id');

  const comment = await Comment.findById(commentId);
  if (!comment) throw httpError(404, 'Comment not found');

  if (comment.isDeleted) {
    res.json({ success: true, data: { _id: comment._id, isDeleted: true } });
    return;
  }

  comment.isDeleted = true;
  comment.body = '';
  await comment.save();

  const counterOps: Promise<unknown>[] = [
    Video.updateOne(
      { _id: comment.video, commentCount: { $gt: 0 } },
      { $inc: { commentCount: -1 } }
    ),
  ];
  if (comment.parent) {
    counterOps.push(
      Comment.updateOne(
        { _id: comment.parent, replyCount: { $gt: 0 } },
        { $inc: { replyCount: -1 } }
      )
    );
  }
  await Promise.all(counterOps);

  logger.info('admin_comment_deleted', {
    actorId: String(req.user._id),
    commentId: String(comment._id),
  });

  res.json({ success: true, data: { _id: comment._id, isDeleted: true } });
});

// ============================================================================
// Disk usage
// ============================================================================

const computeAlertLevel = (percent: number): 'ok' | 'warn' | 'critical' => {
  if (percent >= ALERT_THRESHOLDS.critical) return 'critical';
  if (percent >= ALERT_THRESHOLDS.warn) return 'warn';
  return 'ok';
};

const computeDiskUsage = async () => {
  const processedDir = processedRoot();
  const rawDir = rawRoot();

  const [usedBytes, processedSubs, rawEntries, dbVideoCount, readyVideos] = await Promise.all([
    folderSize(processedDir),
    listSubdirectories(processedDir),
    fs
      .readdir(rawDir, { withFileTypes: true })
      .catch((err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') return [] as Awaited<ReturnType<typeof fs.readdir>>;
        throw err;
      }),
    Video.countDocuments({ status: 'ready' }),
    Video.find({ status: 'ready' }).select('videoId').lean(),
  ]);

  let totalBytes = env.DISK_QUOTA_MB * 1024 * 1024;
  try {
    const fsAny = fs as unknown as { statfs?: (p: string) => Promise<{ blocks: number; bsize: number }> };
    if (typeof fsAny.statfs === 'function') {
      const stats = await fsAny.statfs(processedDir);
      const fsTotal = Number(stats.blocks) * Number(stats.bsize);
      if (Number.isFinite(fsTotal) && fsTotal > 0) {
        totalBytes = Math.min(totalBytes, fsTotal);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('admin_disk_statfs_failed', { errorMessage: message });
  }

  const freeBytes = Math.max(0, totalBytes - usedBytes);
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  const dbVideoIdSet = new Set(readyVideos.map((v) => v.videoId));
  const folderSet = new Set(processedSubs);

  const orphanFolderCount = processedSubs.filter((name) => !dbVideoIdSet.has(name)).length;
  const dbOrphanCount = readyVideos.filter((v) => !folderSet.has(v.videoId)).length;
  const rawCount = rawEntries.filter((entry) => entry.isFile()).length;

  return {
    totalBytes,
    usedBytes,
    freeBytes,
    usedPercent: Number(usedPercent.toFixed(2)),
    videoCount: processedSubs.length,
    rawCount,
    dbVideoCount,
    orphanFolderCount,
    dbOrphanCount,
    quotaMb: env.DISK_QUOTA_MB,
    alertLevel: computeAlertLevel(usedPercent),
  };
};

export const getDiskUsage: RequestHandler = asyncHandler(async (_req, res) => {
  const now = Date.now();
  if (diskCache.value && diskCache.expiresAt > now) {
    res.json({ success: true, data: diskCache.value, cached: true });
    return;
  }
  const data = await computeDiskUsage();
  diskCache = { value: data, expiresAt: now + DISK_CACHE_TTL_MS };
  res.json({ success: true, data, cached: false });
});

// ============================================================================
// Cleanup
// ============================================================================

const parsePositiveNumber = (raw: unknown, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const runCleanup: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const failedOlderThanDays = parsePositiveNumber(
    (req.body as { failedOlderThanDays?: unknown })?.failedOlderThanDays,
    DEFAULT_FAILED_AGE_DAYS
  );
  const dryRun = (req.body as { dryRun?: unknown })?.dryRun === true;

  const processedDir = processedRoot();
  const rawDir = rawRoot();

  const result = {
    dryRun,
    failedVideosDeleted: 0,
    orphanFoldersDeleted: 0,
    missingHlsMarkedFailed: 0,
    staleRawDeleted: 0,
    bytesFreed: 0,
  };

  // 1) Failed videos older than threshold.
  const cutoff = new Date(Date.now() - failedOlderThanDays * 24 * 60 * 60 * 1000);
  const failedVideos = await Video.find({ status: 'failed', updatedAt: { $lt: cutoff } })
    .select('_id videoId author')
    .lean();

  for (const video of failedVideos) {
    const folderPath = path.join(processedDir, video.videoId);
    const size = await folderSize(folderPath);
    result.bytesFreed += size;
    result.failedVideosDeleted += 1;

    if (!dryRun) {
      await Promise.all([
        removeProcessedFolder(video.videoId),
        Video.deleteOne({ _id: video._id }),
        cascadeDeleteVideoData([video._id]),
      ]);
      if (video.author) {
        await User.updateOne(
          { _id: video.author, videoCount: { $gt: 0 } },
          { $inc: { videoCount: -1 } }
        );
      }
    }
  }

  // 2) Orphan folders on disk.
  const processedSubs = await listSubdirectories(processedDir);
  const knownVideos =
    processedSubs.length > 0
      ? await Video.find({ videoId: { $in: processedSubs } }).select('videoId').lean()
      : [];
  const knownSet = new Set(knownVideos.map((v) => v.videoId));
  const orphans = processedSubs.filter((name) => !knownSet.has(name));

  for (const name of orphans) {
    const folderPath = path.join(processedDir, name);
    const size = await folderSize(folderPath);
    result.bytesFreed += size;
    result.orphanFoldersDeleted += 1;
    if (!dryRun) await removeProcessedFolder(name);
  }

  // 3) `ready` rows whose HLS manifest is missing on disk → flip to `failed`.
  const readyVideos = await Video.find({ status: 'ready' }).select('_id videoId').lean();
  const missingDocs: Types.ObjectId[] = [];
  await Promise.all(
    readyVideos.map(async (v) => {
      const indexPath = path.join(processedDir, v.videoId, 'index.m3u8');
      try {
        await fs.access(indexPath);
      } catch {
        missingDocs.push(v._id);
      }
    })
  );
  result.missingHlsMarkedFailed = missingDocs.length;
  if (!dryRun && missingDocs.length > 0) {
    await Video.updateMany(
      { _id: { $in: missingDocs } },
      {
        $set: {
          status: 'failed',
          processingError: 'HLS files missing on disk',
        },
      }
    );
  }

  // 4) Stale raw uploads.
  type DirentLike = { name: string; isFile(): boolean };
  let rawEntries: DirentLike[] = [];
  try {
    rawEntries = (await fs.readdir(rawDir, { withFileTypes: true })) as unknown as DirentLike[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const staleCutoff = Date.now() - STALE_RAW_AGE_MS;
  for (const entry of rawEntries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(rawDir, entry.name);
    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs < staleCutoff) {
        result.bytesFreed += stat.size;
        result.staleRawDeleted += 1;
        if (!dryRun) await fs.unlink(filePath).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  if (!dryRun) {
    diskCache = { value: null, expiresAt: 0 };
  }

  logger.info('admin_cleanup_completed', {
    actorId: String(req.user._id),
    ...result,
  });

  res.json({ success: true, data: result });
});
