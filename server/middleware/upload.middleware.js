import path from 'node:path';
import { fileURLToPath } from 'node:url';

import multer from 'multer';
import { nanoid } from 'nanoid';

import { env } from '../config/env.js';

const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
  'video/webm',
]);

const FILENAME_ID_LENGTH = 16;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_UPLOAD_DIR = path.resolve(__dirname, '..', env.UPLOAD_DIR_RAW);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RAW_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${nanoid(FILENAME_ID_LENGTH)}${extension}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const err = new Error('Unsupported video format');
    err.code = 'UNSUPPORTED_MIME';
    err.status = 415;
    return cb(err);
  }
  cb(null, true);
};

const multerInstance = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter,
});

const singleVideoUpload = multerInstance.single('video');

/**
 * Wraps multer's `single('video')` to translate its raw errors into
 * predictable HTTP errors that flow through the central error handler.
 */
export const uploadVideo = (req, res, next) => {
  singleVideoUpload(req, res, (err) => {
    if (!err) return next();

    let status = Number.isInteger(err.status) ? err.status : 400;
    let message = err.message || 'Upload failed';

    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = `File too large. Max size: ${env.MAX_UPLOAD_SIZE_MB}MB`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      message = 'Unexpected file field. Use field name "video".';
    }

    const httpErr = new Error(message);
    httpErr.status = status;
    next(httpErr);
  });
};
