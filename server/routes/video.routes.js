import { Router } from 'express';

import { uploadVideo as uploadVideoController } from '../controllers/upload.controller.js';
import {
  getStatus,
  listVideos,
  getVideoById,
  getMyVideos,
  updateVideo,
  deleteVideo,
  getByChannel,
} from '../controllers/video.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { creatorOrAdmin } from '../middleware/role.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { uploadVideo as uploadVideoMiddleware } from '../middleware/upload.middleware.js';

const router = Router();

router.get('/', optionalAuth, listVideos);

router.get('/mine', protect, creatorOrAdmin, getMyVideos);

router.get('/by-channel/:userId', optionalAuth, getByChannel);

router.post(
  '/upload',
  uploadLimiter,
  protect,
  creatorOrAdmin,
  uploadVideoMiddleware,
  uploadVideoController
);

router.get('/:videoId/status', optionalAuth, getStatus);

router.get('/:videoId', optionalAuth, getVideoById);

router.patch('/:videoId', protect, creatorOrAdmin, updateVideo);

router.delete('/:videoId', protect, creatorOrAdmin, deleteVideo);

export default router;
