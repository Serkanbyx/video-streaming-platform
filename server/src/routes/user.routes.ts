import { Router } from 'express';

import { getMyHistory } from '../controllers/view.controller.js';
import {
  getPublicProfile,
  getPreferences,
  updatePreferences,
  becomeCreator,
} from '../controllers/user.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  updatePreferencesSchema,
  usernameParamSchema,
} from '@shared/schemas/user.schema.js';

const router = Router();

// All `/me/*` literal routes must be declared before the `/:username` param
// matcher; otherwise Express treats `me` as a username and the param handler
// shadows the literal endpoints.
router.get('/me/preferences', protect, getPreferences);
router.patch(
  '/me/preferences',
  protect,
  validate(updatePreferencesSchema),
  updatePreferences
);
router.post('/me/become-creator', protect, becomeCreator);
router.get('/me/history', protect, getMyHistory);

router.get('/:username', optionalAuth, validate(usernameParamSchema, 'params'), getPublicProfile);

export default router;
