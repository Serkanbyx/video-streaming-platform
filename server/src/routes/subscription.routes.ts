import { Router } from 'express';

import {
  subscribe,
  unsubscribe,
  myChannels,
  subscriptionFeed,
  isSubscribed,
} from '../controllers/subscription.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Order matters: the literal `me` and `me/feed` paths must be matched before
// the `:channelId` param routes, otherwise Express would treat "me" as a
// channel id and reject it as an invalid ObjectId.
router.get('/me', protect, myChannels);
router.get('/me/feed', protect, subscriptionFeed);

router.get('/:channelId/status', optionalAuth, isSubscribed);

router.post('/:channelId', protect, subscribe);
router.delete('/:channelId', protect, unsubscribe);

export default router;
