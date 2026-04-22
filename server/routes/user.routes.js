import { Router } from 'express';

import { getMyHistory } from '../controllers/view.controller.js';
import { protect } from '../middleware/auth.middleware.js';

// Other user-scoped routes (public profile, preferences, become-creator) are
// wired in STEP 16. Only the watch-history endpoint is mounted here for now.
const router = Router();

router.get('/me/history', protect, getMyHistory);

export default router;
