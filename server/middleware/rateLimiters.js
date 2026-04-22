import rateLimit from 'express-rate-limit';

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message },
  });

export const globalLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests, slow down.',
});

export const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts, slow down.',
});

export const uploadLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Upload quota exceeded, try again later.',
});

export const commentLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'You are commenting too fast, slow down.',
});

export const adminLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many admin requests, slow down.',
});
