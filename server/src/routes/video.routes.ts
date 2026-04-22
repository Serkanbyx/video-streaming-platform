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
  getRecommendations,
} from '../controllers/video.controller.js';
import { recordView } from '../controllers/view.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { creatorOrAdmin } from '../middleware/role.middleware.js';
import { uploadLimiter, viewLimiter } from '../middleware/rateLimiters.js';
import { uploadVideo as uploadVideoMiddleware } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createVideoSchema,
  updateVideoSchema,
  recordViewSchema,
  videoIdParamSchema,
} from '@shared/schemas/video.schema.js';

const router = Router();

router.get('/', optionalAuth, listVideos);

router.get('/mine', protect, creatorOrAdmin, getMyVideos);

router.get('/by-channel/:userId', optionalAuth, getByChannel);

// Validators run AFTER multer so multipart fields are populated on `req.body`.
router.post(
  '/upload',
  uploadLimiter,
  protect,
  creatorOrAdmin,
  uploadVideoMiddleware,
  validate(createVideoSchema),
  uploadVideoController
);

router.get('/:videoId/status', optionalAuth, validate(videoIdParamSchema, 'params'), getStatus);

router.get(
  '/:videoId/recommendations',
  optionalAuth,
  validate(videoIdParamSchema, 'params'),
  getRecommendations
);

router.patch(
  '/:videoId/view',
  viewLimiter,
  optionalAuth,
  validate(videoIdParamSchema, 'params'),
  validate(recordViewSchema),
  recordView
);

router.get('/:videoId', optionalAuth, validate(videoIdParamSchema, 'params'), getVideoById);

router.patch(
  '/:videoId',
  protect,
  creatorOrAdmin,
  validate(videoIdParamSchema, 'params'),
  validate(updateVideoSchema),
  updateVideo
);

router.delete(
  '/:videoId',
  protect,
  creatorOrAdmin,
  validate(videoIdParamSchema, 'params'),
  deleteVideo
);

export default router;
