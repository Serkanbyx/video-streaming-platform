import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RequestHandler } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import { nanoid } from 'nanoid';

import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
]);

const FILENAME_ID_LENGTH = 16;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_UPLOAD_DIR = path.resolve(__dirname, '..', '..', env.UPLOAD_DIR_RAW);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RAW_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${nanoid(FILENAME_ID_LENGTH)}${extension}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(httpError(415, 'Unsupported video format'));
    return;
  }
  cb(null, true);
};

const multerInstance = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

const singleVideoUpload = multerInstance.single('video');

export const uploadVideo: RequestHandler = (req, res, next) => {
  singleVideoUpload(req, res, (err: unknown) => {
    if (!err) return next();

    const candidate = err as { code?: string; status?: unknown; message?: string };
    let status = Number.isInteger(candidate.status) ? (candidate.status as number) : 400;
    let message = candidate.message || 'Upload failed';

    if (candidate.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = `File too large. Max size: ${env.MAX_UPLOAD_SIZE_MB}MB`;
    } else if (candidate.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      message = 'Unexpected file field. Use field name "video".';
    }

    next(httpError(status, message));
  });
};
