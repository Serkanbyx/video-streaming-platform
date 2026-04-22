import fs from 'node:fs/promises';

import Video from '../models/Video.js';
import { pickFields } from '../utils/pickFields.js';
import { logger } from '../utils/logger.js';
import { processVideo } from '../services/processing.service.js';

const UPLOAD_FIELDS = ['title', 'description', 'tags', 'visibility'];

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

/**
 * Tags can arrive as an array (multiple `tags` form fields), a JSON string,
 * or a comma-separated string. Normalize into an array before persisting;
 * the Video schema's pre-validate hook trims, lowercases and dedupes.
 */
const normalizeTags = (input) => {
  if (input === undefined || input === null || input === '') return [];
  if (Array.isArray(input)) return input;
  if (typeof input !== 'string') return [];

  const trimmed = input.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to comma-split
    }
  }
  return trimmed.split(',').map((tag) => tag.trim()).filter(Boolean);
};

const safeUnlink = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath).catch(() => {});
};

export const uploadVideo = async (req, res, next) => {
  if (!req.file) return next(httpError(400, 'No file uploaded'));

  try {
    const payload = pickFields(req.body, UPLOAD_FIELDS);

    const videoDoc = await Video.create({
      title: payload.title,
      description: payload.description,
      tags: normalizeTags(payload.tags),
      visibility: payload.visibility,
      author: req.user._id,
      status: 'pending',
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
    });

    res.status(201).json({
      success: true,
      data: { videoId: videoDoc.videoId, status: videoDoc.status },
    });

    processVideo(videoDoc, req.file.path).catch((err) => {
      logger.error('processing_unhandled', {
        videoId: videoDoc.videoId,
        errorMessage: err.message,
      });
    });
  } catch (err) {
    safeUnlink(req.file.path);
    next(err);
  }
};
