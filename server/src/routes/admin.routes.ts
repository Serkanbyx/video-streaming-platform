import { Router } from 'express';

import {
  getDashboardStats,
  listUsers,
  setUserRole,
  toggleBan,
  deleteUser,
  listAllVideos,
  flagVideo,
  adminDeleteVideo,
  listAllComments,
  adminDeleteComment,
  getDiskUsage,
  runCleanup,
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/role.middleware.js';
import { adminLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  setRoleSchema,
  toggleBanSchema,
  flagVideoSchema,
  cleanupSchema,
  userIdParamSchema,
  adminCommentIdParamSchema,
} from '@shared/schemas/admin.schema.js';
import { videoIdParamSchema } from '@shared/schemas/video.schema.js';

const router = Router();

// Triple guard for the entire admin surface: rate limiter caps abuse,
// `protect` requires a valid JWT, `adminOnly` enforces the role.
router.use(adminLimiter, protect, adminOnly);

router.get('/dashboard/stats', getDashboardStats);

router.get('/users', listUsers);
router.patch(
  '/users/:userId/role',
  validate(userIdParamSchema, 'params'),
  validate(setRoleSchema),
  setUserRole
);
router.patch(
  '/users/:userId/ban',
  validate(userIdParamSchema, 'params'),
  validate(toggleBanSchema),
  toggleBan
);
router.delete('/users/:userId', validate(userIdParamSchema, 'params'), deleteUser);

router.get('/videos', listAllVideos);
router.patch(
  '/videos/:videoId/flag',
  validate(videoIdParamSchema, 'params'),
  validate(flagVideoSchema),
  flagVideo
);
router.delete(
  '/videos/:videoId',
  validate(videoIdParamSchema, 'params'),
  adminDeleteVideo
);

router.get('/comments', listAllComments);
router.delete(
  '/comments/:commentId',
  validate(adminCommentIdParamSchema, 'params'),
  adminDeleteComment
);

router.get('/maintenance/disk', getDiskUsage);
router.post('/maintenance/cleanup', validate(cleanupSchema), runCleanup);

export default router;
