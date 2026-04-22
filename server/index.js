import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

import { requestId } from './middleware/requestId.middleware.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { sanitizeMongo } from './middleware/sanitize.middleware.js';
import { globalLimiter } from './middleware/rateLimiters.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

import authRoutes from './routes/auth.routes.js';
import videoRoutes from './routes/video.routes.js';
import userRoutes from './routes/user.routes.js';
import likeRoutes from './routes/like.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXPOSED_HEADERS = [
  'RateLimit-Limit',
  'RateLimit-Remaining',
  'RateLimit-Reset',
  'Retry-After',
  'X-Request-Id',
];

const app = express();

app.disable('x-powered-by');

app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    exposedHeaders: EXPOSED_HEADERS,
  })
);

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

app.use(sanitizeMongo);
app.use(requestLogger);

// HLS streaming is mounted BEFORE the global API rate limiter so that
// segment fetches (one per ~10s of playback) do not consume request budget
// intended for JSON endpoints. `express.static` natively handles HTTP Range
// requests for `.ts` segments, so no custom range logic is needed.
app.use(
  '/api/stream',
  express.static(path.resolve(__dirname, env.UPLOAD_DIR_PROCESSED), {
    fallthrough: false,
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      } else if (filePath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', env.CLIENT_ORIGIN);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.use('/api', globalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/likes', likeRoutes);
// Route mounts wired in subsequent steps:
// app.use('/api/comments', commentRoutes);
// app.use('/api/subscriptions', subscriptionRoutes);
// app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(notFoundHandler);
app.use(errorHandler);

const ensureUploadDirs = async () => {
  await Promise.all([
    fs.mkdir(path.resolve(__dirname, env.UPLOAD_DIR_RAW), { recursive: true }),
    fs.mkdir(path.resolve(__dirname, env.UPLOAD_DIR_PROCESSED), { recursive: true }),
  ]);
};

const start = async () => {
  await ensureUploadDirs();
  await connectDB();
  app.listen(env.PORT, () => {
    logger.info('server_started', {
      port: env.PORT,
      environment: env.NODE_ENV,
      clientOrigin: env.CLIENT_ORIGIN,
    });
  });
};

start().catch((err) => {
  logger.error('startup_failed', { errorMessage: err.message, stack: err.stack });
  process.exit(1);
});

export { app };
