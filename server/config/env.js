import 'dotenv/config';

const requireEnv = (key) => {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`[ENV] Missing required environment variable: ${key}`);
  }
  return value;
};

const parseNumber = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`[ENV] ${key} must be a valid number, received: "${raw}"`);
  }
  return parsed;
};

const parseString = (key, fallback) => {
  const raw = process.env[key];
  return raw === undefined || raw === '' ? fallback : raw;
};

const NODE_ENV = parseString('NODE_ENV', 'development');
const isProduction = NODE_ENV === 'production';

const JWT_SECRET = requireEnv('JWT_SECRET');
if (isProduction && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

export const env = Object.freeze({
  NODE_ENV,
  isProduction,
  PORT: parseNumber('PORT', 5000),

  MONGO_URI: requireEnv('MONGO_URI'),

  JWT_SECRET,
  JWT_EXPIRES_IN: parseString('JWT_EXPIRES_IN', '7d'),
  BCRYPT_SALT_ROUNDS: parseNumber('BCRYPT_SALT_ROUNDS', 12),

  CLIENT_ORIGIN: parseString('CLIENT_ORIGIN', 'http://localhost:5173'),

  MAX_UPLOAD_SIZE_MB: parseNumber('MAX_UPLOAD_SIZE_MB', isProduction ? 100 : 500),
  UPLOAD_DIR_RAW: parseString('UPLOAD_DIR_RAW', 'uploads/raw'),
  UPLOAD_DIR_PROCESSED: parseString('UPLOAD_DIR_PROCESSED', 'uploads/processed'),

  HLS_SEGMENT_DURATION: parseNumber('HLS_SEGMENT_DURATION', 10),
  THUMBNAIL_TIMESTAMP: parseString('THUMBNAIL_TIMESTAMP', '00:00:02'),
  MAX_VIDEO_DURATION_SECONDS: parseNumber(
    'MAX_VIDEO_DURATION_SECONDS',
    isProduction ? 120 : 600
  ),
  DISK_QUOTA_MB: parseNumber('DISK_QUOTA_MB', 2800),
});
