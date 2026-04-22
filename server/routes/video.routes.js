import { Router } from 'express';

import { uploadVideo as uploadVideoController } from '../controllers/upload.controller.js';
import { getStatus } from '../controllers/video.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { creatorOrAdmin } from '../middleware/role.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { uploadVideo as uploadVideoMiddleware } from '../middleware/upload.middleware.js';

const router = Router();

router.get('/:videoId/status', optionalAuth, getStatus);

router.post(
  '/upload',
  uploadLimiter,
  protect,
  creatorOrAdmin,
  uploadVideoMiddleware,
  uploadVideoController
);

export default router;
