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
  registerRules,
  loginRules,
  changePasswordRules,
  deleteAccountRules,
} from '../validators/auth.validator.js';
import { updateProfileRules } from '../validators/user.validator.js';

const router = Router();

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);

router.get('/me', protect, getMe);
router.patch('/me', protect, updateProfileRules, validate, updateProfile);
router.delete('/me', protect, deleteAccountRules, validate, deleteAccount);

router.post(
  '/change-password',
  protect,
  authLimiter,
  changePasswordRules,
  validate,
  changePassword
);

export default router;
