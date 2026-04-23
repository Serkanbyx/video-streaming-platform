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

/**
 * Renders a short, muted, looping MP4 preview used as an animated card cover.
 *
 * Why MP4 instead of GIF/animated-WebP:
 *  - Universal browser support via `<video autoplay muted loop playsinline>`.
 *  - No external encoder dependency (libwebp_anim is not always present).
 *  - Smaller payload than GIF at equivalent visual quality (~80–150 KB vs ~300 KB).
 *
 * Tuning: 4 s @ 12 fps, 320×180 (16:9), CRF 32 keeps preview files tiny while
 * still legible on a card. Audio track is dropped entirely (`-an`) so previews
 * never trigger autoplay restrictions in browsers.
 *
 * Resilience: if the source video is shorter than the preview window, ffmpeg
 * naturally truncates the output without error.
 */
export const generatePreview = (
  inputPath: string,
  outputDir: string
): Promise<string> =>
  new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(0)
      .duration(4)
      .noAudio()
      .videoCodec('libx264')
      .videoFilters('fps=12,scale=320:-2:flags=lanczos,format=yuv420p')
      .addOption('-preset', 'veryfast')
      .addOption('-crf', '32')
      .addOption('-movflags', '+faststart')
      .output(path.join(outputDir, 'preview.mp4'))
      .on('end', () => resolve('preview.mp4'))
      .on('error', reject)
      .run();
  });
