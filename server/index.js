import path from 'node:path';
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

app.use('/api', globalLimiter);

app.use(
  '/processed',
  express.static(path.join(__dirname, env.UPLOAD_DIR_PROCESSED), {
    fallthrough: false,
    index: false,
    maxAge: '1h',
  })
);

// Route mounts are wired in subsequent steps:
// app.use('/api/auth', authRoutes);
// app.use('/api/videos', videoRoutes);
// app.use('/api/comments', commentRoutes);
// app.use('/api/likes', likeRoutes);
// app.use('/api/subscriptions', subscriptionRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use(notFoundHandler);
app.use(errorHandler);

const start = async () => {
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
