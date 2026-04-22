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
  createRules,
  updateRules,
  listQueryRules,
  viewRules,
  videoIdParamRules,
} from '../validators/video.validator.js';

const router = Router();

router.get('/', optionalAuth, listQueryRules, validate, listVideos);

router.get('/mine', protect, creatorOrAdmin, listQueryRules, validate, getMyVideos);

router.get('/by-channel/:userId', optionalAuth, listQueryRules, validate, getByChannel);

// Validators run AFTER multer so multipart fields are populated on `req.body`.
router.post(
  '/upload',
  uploadLimiter,
  protect,
  creatorOrAdmin,
  uploadVideoMiddleware,
  createRules,
  validate,
  uploadVideoController
);

router.get('/:videoId/status', optionalAuth, videoIdParamRules, validate, getStatus);

router.get(
  '/:videoId/recommendations',
  optionalAuth,
  videoIdParamRules,
  validate,
  getRecommendations
);

router.patch(
  '/:videoId/view',
  viewLimiter,
  optionalAuth,
  videoIdParamRules,
  viewRules,
  validate,
  recordView
);

router.get('/:videoId', optionalAuth, videoIdParamRules, validate, getVideoById);

router.patch(
  '/:videoId',
  protect,
  creatorOrAdmin,
  videoIdParamRules,
  updateRules,
  validate,
  updateVideo
);

router.delete(
  '/:videoId',
  protect,
  creatorOrAdmin,
  videoIdParamRules,
  validate,
  deleteVideo
);

export default router;
