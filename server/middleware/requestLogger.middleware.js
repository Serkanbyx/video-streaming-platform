import { logger } from '../utils/logger.js';

const SKIP_PATHS = [/^\/api\/health$/, /^\/api\/stream\/.+\.ts$/];

export const requestLogger = (req, res, next) => {
  if (SKIP_PATHS.some((re) => re.test(req.originalUrl))) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?._id?.toString(),
    });
  });

  next();
};
