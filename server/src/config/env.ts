import 'dotenv/config';
import { z } from 'zod';

const stringWithDefault = (defaultValue: string) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? defaultValue : value));

const numberWithDefault = (defaultValue: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return defaultValue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid number' });
        return z.NEVER;
      }
      return parsed;
    });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: numberWithDefault(5000),
    MONGO_URI: z.string().min(1, '[ENV] MONGO_URI is required'),
    JWT_SECRET: z.string().min(1, '[ENV] JWT_SECRET is required'),
    JWT_EXPIRES_IN: stringWithDefault('7d'),
    BCRYPT_SALT_ROUNDS: numberWithDefault(12),
    CLIENT_ORIGIN: stringWithDefault('http://localhost:5173'),
    MAX_UPLOAD_SIZE_MB: numberWithDefault(500),
    UPLOAD_DIR_RAW: stringWithDefault('uploads/raw'),
    UPLOAD_DIR_PROCESSED: stringWithDefault('uploads/processed'),
    HLS_SEGMENT_DURATION: numberWithDefault(10),
    THUMBNAIL_TIMESTAMP: stringWithDefault('00:00:02'),
    MAX_VIDEO_DURATION_SECONDS: numberWithDefault(600),
    DISK_QUOTA_MB: numberWithDefault(2800),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  throw new Error(`[ENV] Invalid environment configuration:\n${messages}`);
}

const data = parsed.data;
const isProduction = data.NODE_ENV === 'production';

export const env = Object.freeze({
  ...data,
  isProduction,
  MAX_UPLOAD_SIZE_MB: data.MAX_UPLOAD_SIZE_MB ?? (isProduction ? 100 : 500),
  MAX_VIDEO_DURATION_SECONDS: data.MAX_VIDEO_DURATION_SECONDS ?? (isProduction ? 120 : 600),
});

export type Env = typeof env;
