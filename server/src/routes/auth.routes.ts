import { Router } from 'express';

import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '@shared/schemas/auth.schema.js';
import { updateProfileSchema } from '@shared/schemas/user.schema.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);

router.get('/me', protect, getMe);
router.patch('/me', protect, validate(updateProfileSchema), updateProfile);
router.delete('/me', protect, validate(deleteAccountSchema), deleteAccount);

router.post(
  '/change-password',
  protect,
  authLimiter,
  validate(changePasswordSchema),
  changePassword
);

export default router;
