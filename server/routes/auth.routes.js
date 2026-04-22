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

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.get('/me', protect, getMe);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, deleteAccount);

router.post('/change-password', protect, authLimiter, changePassword);

export default router;
