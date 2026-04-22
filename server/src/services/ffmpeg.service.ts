import path from 'node:path';

import ffmpeg from 'fluent-ffmpeg';

import { env } from '../config/env.js';

export const probeDuration = (inputPath: string): Promise<number> =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) =>
      err ? reject(err) : resolve(Math.round(data?.format?.duration ?? 0))
    );
  });

export interface TranscodeResult {
  duration: number;
}

export const transcodeToHls = (
  inputPath: string,
  outputDir: string
): Promise<TranscodeResult> =>
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
            : resolve({ duration: Math.round(data?.format?.duration ?? 0) })
        )
      )
      .on('error', reject)
      .run();
  });

export const generateThumbnail = (
  inputPath: string,
  outputDir: string
): Promise<string> =>
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
