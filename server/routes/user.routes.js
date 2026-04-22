import { Router } from 'express';

import { getMyHistory } from '../controllers/view.controller.js';
import { getPublicProfile } from '../controllers/user.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

// Preferences and become-creator routes are wired in STEP 16. Channel profile
// (`GET /:username`) is part of STEP 15 because it powers the public profile
// surface used by the subscription/recommendation flows.
const router = Router();

router.get('/me/history', protect, getMyHistory);

// Must be declared after `/me/*` literal routes so the param matcher does not
// shadow them.
router.get('/:username', optionalAuth, getPublicProfile);

export default router;
