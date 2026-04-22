import mongoose from 'mongoose';

import Comment from '../models/Comment.js';
import Video from '../models/Video.js';
import { logger } from '../utils/logger.js';

const AUTHOR_PROJECTION = 'username displayName avatarUrl';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

const DELETED_PLACEHOLDER = '[deleted]';

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

const parseBody = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw.trim();
};

const validateBody = (body) => {
  if (!body) throw httpError(422, 'Comment body is required');
  if (body.length > Comment.BODY_MAX) {
    throw httpError(
      422,
      `Comment body must be at most ${Comment.BODY_MAX} characters`
    );
  }
};

/**
 * Strips PII from soft-deleted comments at the response boundary so the thread
 * structure survives without leaking the original text or the author identity.
 */
const serializeComment = (comment) => {
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

const findReadyPublicVideo = async (videoId) => {
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

export const listForVideo = async (req, res, next) => {
  try {
    const video = await findReadyPublicVideo(req.params.videoId);

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
        items: items.map(serializeComment),
        page,
        totalPages,
        total,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      throw httpError(400, 'Invalid comment id');
    }

    const parent = await Comment.findById(commentId)
      .select('_id video parent')
      .lean();

    if (!parent) throw httpError(404, 'Parent comment not found');
    // Defensive: replies only live one level deep. Refusing to enumerate
    // children of a reply keeps the public surface aligned with the schema.
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
        items: items.map(serializeComment),
        page,
        totalPages,
        total,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createComment = async (req, res, next) => {
  try {
    const { videoId, parent: parentRaw } = req.body ?? {};
    const body = parseBody(req.body?.body);

    if (typeof videoId !== 'string' || !videoId.trim()) {
      throw httpError(422, 'videoId is required');
    }

    validateBody(body);

    const video = await findReadyPublicVideo(videoId.trim());

    let parentId = null;
    if (parentRaw !== undefined && parentRaw !== null && parentRaw !== '') {
      if (!mongoose.isValidObjectId(parentRaw)) {
        throw httpError(422, 'Invalid parent id');
      }
      const parentComment = await Comment.findById(parentRaw)
        .select('_id video parent')
        .lean();
      if (!parentComment) throw httpError(404, 'Parent comment not found');
      // Cross-video reply forgery guard — without this, a client could attach
      // a reply to comment X under video A while the parent actually belongs
      // to video B, polluting both threads.
      if (!parentComment.video.equals(video._id)) {
        throw httpError(400, 'Parent comment does not belong to this video');
      }
      // Single-level threads only.
      if (parentComment.parent) {
        throw httpError(400, 'Replies cannot be nested further');
      }
      parentId = parentComment._id;
    }

    const created = await Comment.create({
      video: video._id,
      author: req.user._id,
      parent: parentId,
      body,
    });

    // Counter maintenance: video.commentCount tracks all comments (top + reply)
    // matching the denormalization in the Video schema; parent.replyCount
    // tracks replies only under the top-level parent.
    const counterOps = [
      Video.updateOne({ _id: video._id }, { $inc: { commentCount: 1 } }),
    ];
    if (parentId) {
      counterOps.push(
        Comment.updateOne({ _id: parentId }, { $inc: { replyCount: 1 } })
      );
    }
    await Promise.all(counterOps);

    await created.populate('author', AUTHOR_PROJECTION);

    res.status(201).json({
      success: true,
      data: serializeComment(created.toObject()),
    });
  } catch (err) {
    next(err);
  }
};

export const editComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      throw httpError(400, 'Invalid comment id');
    }

    const body = parseBody(req.body?.body);
    validateBody(body);

    const comment = await Comment.findById(commentId);
    if (!comment) throw httpError(404, 'Comment not found');

    if (comment.isDeleted) {
      throw httpError(410, 'Comment has been deleted');
    }

    // Edits are author-only by design — admins/video authors can remove via
    // soft delete but must not be able to rewrite someone else's words.
    if (!req.user._id.equals(comment.author)) {
      throw httpError(403, 'You can only edit your own comments');
    }

    comment.body = body;
    comment.isEdited = true;
    await comment.save();

    await comment.populate('author', AUTHOR_PROJECTION);

    res.json({ success: true, data: serializeComment(comment.toObject()) });
  } catch (err) {
    next(err);
  }
};

export const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      throw httpError(400, 'Invalid comment id');
    }

    const comment = await Comment.findById(commentId);
    if (!comment) throw httpError(404, 'Comment not found');

    if (comment.isDeleted) {
      // Idempotent: already-deleted is treated as success so retries from a
      // flaky client don't surface as 404 noise.
      return res.json({
        success: true,
        data: serializeComment(comment.toObject()),
      });
    }

    const video = await Video.findById(comment.video).select('_id author').lean();
    if (!video) throw httpError(404, 'Video not found');

    const isOwner = req.user._id.equals(comment.author);
    const isAdmin = req.user.role === 'admin';
    const isVideoAuthor = req.user._id.equals(video.author);

    if (!isOwner && !isAdmin && !isVideoAuthor) {
      throw httpError(403, 'Forbidden');
    }

    comment.isDeleted = true;
    comment.body = '';
    await comment.save();

    // Counter maintenance mirrors createComment but guards each $inc against
    // an underflow window where the value is already 0.
    const counterOps = [
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

    res.json({ success: true, data: serializeComment(comment.toObject()) });
  } catch (err) {
    next(err);
  }
};
