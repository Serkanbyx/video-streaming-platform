import path from 'node:path';

import ffmpeg from 'fluent-ffmpeg';

import { env } from '../config/env.js';

/**
 * Pre-flight duration probe. Resolves with integer seconds.
 * Used to reject overlong uploads BEFORE any transcoding work is done.
 */
export const probeDuration = (inputPath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) =>
      err ? reject(err) : resolve(Math.round(data?.format?.duration || 0))
    );
  });

/**
 * Transcode an input file into an HLS bundle (`index.m3u8` + numbered `.ts` segments).
 * Resolves with `{ duration }` (integer seconds), measured via ffprobe after success.
 */
export const transcodeToHls = (inputPath, outputDir) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(path.join(outputDir, 'index.m3u8'))
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOption('-preset', 'veryfast')
      .addOption('-hls_time', String(env.HLS_SEGMENT_DURATION))
      .addOption('-hls_list_size', '0')
      .addOption('-hls_segment_filename', path.join(outputDir, '%03d.ts'))
      .addOption('-f', 'hls')
      .on('end', () =>
        ffmpeg.ffprobe(inputPath, (err, data) =>
          err
            ? reject(err)
            : resolve({ duration: Math.round(data?.format?.duration || 0) })
        )
      )
      .on('error', reject)
      .run();
  });

/**
 * Capture a single thumbnail (1280x720 JPEG) at the configured timestamp.
 * Resolves with the thumbnail filename ('thumbnail.jpg') on success.
 */
export const generateThumbnail = (inputPath, outputDir) =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [env.THUMBNAIL_TIMESTAMP],
        filename: 'thumbnail.jpg',
        folder: outputDir,
        size: '1280x720',
      })
      .on('end', () => resolve('thumbnail.jpg'))
      .on('error', reject);
  });
