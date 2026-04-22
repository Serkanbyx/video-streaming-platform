import { Router } from 'express';

import {
  listForVideo,
  listReplies,
  createComment,
  editComment,
  deleteComment,
} from '../controllers/comment.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { commentLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createCommentSchema,
  editCommentSchema,
  commentIdParamSchema,
} from '@shared/schemas/comment.schema.js';
import { videoIdParamSchema } from '@shared/schemas/video.schema.js';

const router = Router();

router.get(
  '/video/:videoId',
  optionalAuth,
  validate(videoIdParamSchema, 'params'),
  listForVideo
);

router.get(
  '/:commentId/replies',
  optionalAuth,
  validate(commentIdParamSchema, 'params'),
  listReplies
);

router.post('/', protect, commentLimiter, validate(createCommentSchema), createComment);

router.patch(
  '/:commentId',
  protect,
  validate(commentIdParamSchema, 'params'),
  validate(editCommentSchema),
  editComment
);

router.delete(
  '/:commentId',
  protect,
  validate(commentIdParamSchema, 'params'),
  deleteComment
);

export default router;
