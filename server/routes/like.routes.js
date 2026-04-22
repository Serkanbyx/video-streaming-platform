import { Router } from 'express';

import {
  setReaction,
  removeReaction,
  getMyReaction,
} from '../controllers/like.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/:videoId/me', optionalAuth, getMyReaction);
router.post('/:videoId', protect, setReaction);
router.delete('/:videoId', protect, removeReaction);

export default router;
