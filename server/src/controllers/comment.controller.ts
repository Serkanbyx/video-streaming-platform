import type { RequestHandler } from 'express';
import mongoose from 'mongoose';

import Comment, { COMMENT_BODY_MAX, type CommentDoc } from '../models/Comment.js';
import Video from '../models/Video.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const AUTHOR_PROJECTION = 'username displayName avatarUrl';
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
const DELETED_PLACEHOLDER = '[deleted]';

const clampPage = (raw: unknown): number => {
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const clampLimit = (raw: unknown): number => {
  const parsed = parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, parsed);
};

const parseBody = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  return raw.trim();
};

const validateBody = (body: string): void => {
  if (!body) throw httpError(422, 'Comment body is required');
  if (body.length > COMMENT_BODY_MAX) {
    throw httpError(422, `Comment body must be at most ${COMMENT_BODY_MAX} characters`);
  }
};

interface SerializableComment {
  _id: unknown;
  video: unknown;
  parent: unknown;
  author?: unknown;
  body: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyCount?: number;
  createdAt: unknown;
  updatedAt: unknown;
}

const serializeComment = (comment: SerializableComment) => {
  const isDeleted = !!comment.isDeleted;
  return {
    _id: comment._id,
    video: comment.video,
    parent: comment.parent ?? null,
    author: isDeleted ? null : comment.author ?? null,
    body: isDeleted ? DELETED_PLACEHOLDER : comment.body,
    isEdited: !!comment.isEdited,
    isDeleted,
    replyCount: comment.replyCount ?? 0,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
};

const findReadyPublicVideo = async (videoId: string) => {
  const video = await Video.findOne({
    videoId,
    status: 'ready',
    visibility: 'public',
  })
    .select('_id author videoId')
    .lean();
  if (!video) throw httpError(404, 'Video not found');
  return video;
};

export const listForVideo: RequestHandler = asyncHandler(async (req, res) => {
  const video = await findReadyPublicVideo(String(req.params.videoId));

  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const filter = { video: video._id, parent: null };

  const [items, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_PROJECTION)
      .lean(),
    Comment.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: {
      items: items.map((item) => serializeComment(item as unknown as SerializableComment)),
      page,
      totalPages,
      total,
      limit,
    },
  });
});

export const listReplies: RequestHandler = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!commentId || !mongoose.isValidObjectId(commentId)) {
    throw httpError(400, 'Invalid comment id');
  }

  const parent = await Comment.findById(commentId).select('_id video parent').lean();
  if (!parent) throw httpError(404, 'Parent comment not found');
  if (parent.parent) throw httpError(400, 'Replies are not nestable');

  const page = clampPage(req.query.page);
  const limit = clampLimit(req.query.limit);
  const skip = (page - 1) * limit;

  const filter = { video: parent.video, parent: parent._id };

  const [items, total] = await Promise.all([
    Comment.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', AUTHOR_PROJECTION)
      .lean(),
    Comment.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    success: true,
    data: {
      items: items.map((item) => serializeComment(item as unknown as SerializableComment)),
      page,
      totalPages,
      total,
      limit,
    },
  });
});

export const createComment: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const { videoId, parent: parentRaw } = (req.body ?? {}) as {
    videoId?: string;
    parent?: string;
  };
  const body = parseBody((req.body as { body?: unknown })?.body);

  if (typeof videoId !== 'string' || !videoId.trim()) {
    throw httpError(422, 'videoId is required');
  }
  validateBody(body);

  const video = await findReadyPublicVideo(videoId.trim());

  let parentId: CommentDoc['_id'] | null = null;
  if (parentRaw !== undefined && parentRaw !== null && parentRaw !== '') {
    if (!mongoose.isValidObjectId(parentRaw)) throw httpError(422, 'Invalid parent id');
    const parentComment = await Comment.findById(parentRaw).select('_id video parent').lean();
    if (!parentComment) throw httpError(404, 'Parent comment not found');
    if (!parentComment.video.equals(video._id)) {
      throw httpError(400, 'Parent comment does not belong to this video');
    }
    if (parentComment.parent) throw httpError(400, 'Replies cannot be nested further');
    parentId = parentComment._id;
  }

  const created = await Comment.create({
    video: video._id,
    author: req.user._id,
    parent: parentId,
    body,
  });

  const counterOps: Promise<unknown>[] = [
    Video.updateOne({ _id: video._id }, { $inc: { commentCount: 1 } }),
  ];
  if (parentId) {
    counterOps.push(Comment.updateOne({ _id: parentId }, { $inc: { replyCount: 1 } }));
  }
  await Promise.all(counterOps);

  await created.populate('author', AUTHOR_PROJECTION);

  res.status(201).json({
    success: true,
    data: serializeComment(created.toObject() as unknown as SerializableComment),
  });
});

export const editComment: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const { commentId } = req.params;
  if (!commentId || !mongoose.isValidObjectId(commentId)) {
    throw httpError(400, 'Invalid comment id');
  }

  const body = parseBody((req.body as { body?: unknown })?.body);
  validateBody(body);

  const comment = await Comment.findById(commentId);
  if (!comment) throw httpError(404, 'Comment not found');
  if (comment.isDeleted) throw httpError(410, 'Comment has been deleted');
  if (!req.user._id.equals(comment.author)) {
    throw httpError(403, 'You can only edit your own comments');
  }

  comment.body = body;
  comment.isEdited = true;
  await comment.save();

  await comment.populate('author', AUTHOR_PROJECTION);

  res.json({
    success: true,
    data: serializeComment(comment.toObject() as unknown as SerializableComment),
  });
});

export const deleteComment: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw httpError(401, 'Authentication required');
  const { commentId } = req.params;
  if (!commentId || !mongoose.isValidObjectId(commentId)) {
    throw httpError(400, 'Invalid comment id');
  }

  const comment = await Comment.findById(commentId);
  if (!comment) throw httpError(404, 'Comment not found');

  if (comment.isDeleted) {
    res.json({
      success: true,
      data: serializeComment(comment.toObject() as unknown as SerializableComment),
    });
    return;
  }

  const video = await Video.findById(comment.video).select('_id author').lean();
  if (!video) throw httpError(404, 'Video not found');

  const isOwner = req.user._id.equals(comment.author);
  const isAdmin = req.user.role === 'admin';
  const isVideoAuthor = req.user._id.equals(video.author);

  if (!isOwner && !isAdmin && !isVideoAuthor) throw httpError(403, 'Forbidden');

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

  logger.info('comment_deleted', {
    commentId: String(comment._id),
    actorId: String(req.user._id),
    mode: isOwner ? 'owner' : isAdmin ? 'admin' : 'video_author',
  });

  res.json({
    success: true,
    data: serializeComment(comment.toObject() as unknown as SerializableComment),
  });
});
