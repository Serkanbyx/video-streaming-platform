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
  createRules,
  editRules,
  commentIdParamRules,
} from '../validators/comment.validator.js';
import { videoIdParamRules } from '../validators/video.validator.js';

const router = Router();

router.get(
  '/video/:videoId',
  optionalAuth,
  videoIdParamRules,
  validate,
  listForVideo
);

router.get(
  '/:commentId/replies',
  optionalAuth,
  commentIdParamRules,
  validate,
  listReplies
);

router.post('/', protect, commentLimiter, createRules, validate, createComment);

router.patch(
  '/:commentId',
  protect,
  commentIdParamRules,
  editRules,
  validate,
  editComment
);

router.delete(
  '/:commentId',
  protect,
  commentIdParamRules,
  validate,
  deleteComment
);

export default router;
