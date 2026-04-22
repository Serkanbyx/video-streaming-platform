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

const router = Router();

// Triple guard for the entire admin surface: rate limiter caps abuse,
// `protect` requires a valid JWT, `adminOnly` enforces the role.
router.use(adminLimiter, protect, adminOnly);

router.get('/dashboard/stats', getDashboardStats);

router.get('/users', listUsers);
router.patch('/users/:userId/role', setUserRole);
router.patch('/users/:userId/ban', toggleBan);
router.delete('/users/:userId', deleteUser);

router.get('/videos', listAllVideos);
router.patch('/videos/:videoId/flag', flagVideo);
router.delete('/videos/:videoId', adminDeleteVideo);

router.get('/comments', listAllComments);
router.delete('/comments/:commentId', adminDeleteComment);

router.get('/maintenance/disk', getDiskUsage);
router.post('/maintenance/cleanup', runCleanup);

export default router;
