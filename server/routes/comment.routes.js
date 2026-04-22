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

const router = Router();

router.get('/video/:videoId', optionalAuth, listForVideo);
router.get('/:commentId/replies', optionalAuth, listReplies);

router.post('/', protect, commentLimiter, createComment);
router.patch('/:commentId', protect, editComment);
router.delete('/:commentId', protect, deleteComment);

export default router;
