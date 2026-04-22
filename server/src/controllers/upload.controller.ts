import fs from 'node:fs/promises';

import type { RequestHandler } from 'express';

import Video from '../models/Video.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { processVideo } from '../services/processing.service.js';

const safeUnlink = (filePath: string | undefined): void => {
  if (!filePath) return;
  fs.unlink(filePath).catch(() => {});
};

interface UploadBody {
  title: string;
  description?: string;
  tags?: string[];
  visibility?: 'public' | 'unlisted';
}

export const uploadVideo: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'No file uploaded');
  if (!req.user) throw httpError(401, 'Authentication required');

  const payload = req.body as UploadBody;

  try {
    const videoDoc = await Video.create({
      title: payload.title,
      description: payload.description ?? '',
      tags: payload.tags ?? [],
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

    processVideo(videoDoc, req.file.path).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('processing_unhandled', {
        videoId: videoDoc.videoId,
        errorMessage: message,
      });
    });
  } catch (err) {
    safeUnlink(req.file?.path);
    throw err;
  }
});
