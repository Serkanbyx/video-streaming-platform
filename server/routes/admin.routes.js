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
  setRoleRules,
  toggleBanRules,
  flagVideoRules,
  cleanupRules,
  userIdParamRules,
  commentIdParamRules,
} from '../validators/admin.validator.js';
import { videoIdParamRules } from '../validators/video.validator.js';

const router = Router();

// Triple guard for the entire admin surface: rate limiter caps abuse,
// `protect` requires a valid JWT, `adminOnly` enforces the role.
router.use(adminLimiter, protect, adminOnly);

router.get('/dashboard/stats', getDashboardStats);

router.get('/users', listUsers);
router.patch(
  '/users/:userId/role',
  userIdParamRules,
  setRoleRules,
  validate,
  setUserRole
);
router.patch(
  '/users/:userId/ban',
  userIdParamRules,
  toggleBanRules,
  validate,
  toggleBan
);
router.delete('/users/:userId', userIdParamRules, validate, deleteUser);

router.get('/videos', listAllVideos);
router.patch(
  '/videos/:videoId/flag',
  videoIdParamRules,
  flagVideoRules,
  validate,
  flagVideo
);
router.delete(
  '/videos/:videoId',
  videoIdParamRules,
  validate,
  adminDeleteVideo
);

router.get('/comments', listAllComments);
router.delete(
  '/comments/:commentId',
  commentIdParamRules,
  validate,
  adminDeleteComment
);

router.get('/maintenance/disk', getDiskUsage);
router.post('/maintenance/cleanup', cleanupRules, validate, runCleanup);

export default router;
