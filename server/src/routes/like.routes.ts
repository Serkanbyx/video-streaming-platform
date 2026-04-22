import { Router } from 'express';

import {
  setReaction,
  removeReaction,
  getMyReaction,
} from '../controllers/like.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { videoIdParamSchema, reactionSchema } from '@shared/schemas/video.schema.js';

const router = Router();

router.get('/:videoId/me', optionalAuth, validate(videoIdParamSchema, 'params'), getMyReaction);
router.post(
  '/:videoId',
  protect,
  validate(videoIdParamSchema, 'params'),
  validate(reactionSchema),
  setReaction
);
router.delete('/:videoId', protect, validate(videoIdParamSchema, 'params'), removeReaction);

export default router;
