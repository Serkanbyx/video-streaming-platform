import fs from 'node:fs';
import path from 'node:path';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import type { VideoDoc } from '../models/Video.js';
import { generateThumbnail, probeDuration, transcodeToHls } from './ffmpeg.service.js';

/**
 * Orchestrates the full HLS pipeline for a single uploaded video.
 *
 * Guarantees:
 *  - Pre-flight duration check rejects overlong uploads BEFORE any disk write.
 *  - On any failure, the partial processed/<videoId>/ folder is removed.
 *  - The raw upload is ALWAYS unlinked (success or failure) via `finally`.
 *  - Status state machine: pending -> processing -> ready | failed.
 */
export const processVideo = async (videoDoc: VideoDoc, rawPath: string): Promise<void> => {
  const outputDir = path.join(env.UPLOAD_DIR_PROCESSED, videoDoc.videoId);

  try {
    const probedDuration = await probeDuration(rawPath);
    if (probedDuration > env.MAX_VIDEO_DURATION_SECONDS) {
      throw new Error(
        `Video exceeds maximum duration (${env.MAX_VIDEO_DURATION_SECONDS}s)`
      );
    }

    await fs.promises.mkdir(outputDir, { recursive: true });

    videoDoc.status = 'processing';
    await videoDoc.save();

    logger.info('processing_started', {
      videoId: videoDoc.videoId,
      probedDuration,
    });

    const [{ duration }] = await Promise.all([
      transcodeToHls(rawPath, outputDir),
      generateThumbnail(rawPath, outputDir),
    ]);

    videoDoc.duration = duration;
    videoDoc.hlsPath = `processed/${videoDoc.videoId}/index.m3u8`;
    videoDoc.thumbnailPath = `processed/${videoDoc.videoId}/thumbnail.jpg`;
    videoDoc.status = 'ready';
    await videoDoc.save();

    await User.findByIdAndUpdate(videoDoc.author, { $inc: { videoCount: 1 } });

    logger.info('processing_succeeded', {
      videoId: videoDoc.videoId,
      duration,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    videoDoc.status = 'failed';
    videoDoc.processingError = message;
    await videoDoc.save().catch((saveErr: unknown) => {
      const saveMessage = saveErr instanceof Error ? saveErr.message : String(saveErr);
      logger.error('processing_status_save_failed', {
        videoId: videoDoc.videoId,
        errorMessage: saveMessage,
      });
    });

    await fs.promises.rm(outputDir, { recursive: true, force: true }).catch(() => {});

    logger.error('processing_failed', {
      videoId: videoDoc.videoId,
      errorMessage: message,
    });
  } finally {
    await fs.promises.unlink(rawPath).catch(() => {});
  }
};
