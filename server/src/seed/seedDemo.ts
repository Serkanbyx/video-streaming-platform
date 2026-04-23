import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import { logger } from '../utils/logger.js';
import User, { type UserDoc } from '../models/User.js';
import Video, { type VideoDoc } from '../models/Video.js';
import Comment from '../models/Comment.js';
import Subscription from '../models/Subscription.js';
import { processVideo } from '../services/processing.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ASSETS_DIR = path.resolve(__dirname, 'demo-assets');
const DEMO_ASSETS_DIR = process.env.DEMO_ASSETS_DIR ?? DEFAULT_ASSETS_DIR;
const METADATA_PATH = path.join(DEMO_ASSETS_DIR, 'metadata.json');
const VIDEOS_DIR = path.join(DEMO_ASSETS_DIR, 'videos');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'fragment-demo-2026';

const userBaseSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may contain only letters, numbers and underscore'),
  displayName: z.string().min(1).max(48),
  email: z.string().email(),
  bio: z.string().max(280).default(''),
});

const creatorSchema = userBaseSchema.extend({
  bannerUrl: z.string().url().nullable().default(null),
});

const viewerSchema = userBaseSchema;

const videoSchema = z.object({
  file: z.string().min(1),
  creator: z.string().min(1),
  title: z.string().min(3).max(120),
  description: z.string().max(5000),
  tags: z.array(z.string().min(1).max(24)).max(8),
});

const commentSchema = z.object({
  video: z.string().min(1),
  author: z.string().min(1),
  body: z.string().min(1).max(1000),
});

const subscriptionSchema = z.object({
  subscriber: z.string().min(1),
  channel: z.string().min(1),
});

const seedSchema = z.object({
  creators: z.array(creatorSchema).min(1),
  viewers: z.array(viewerSchema).default([]),
  videos: z.array(videoSchema),
  comments: z.array(commentSchema),
  subscriptions: z.array(subscriptionSchema),
});

type SeedData = z.infer<typeof seedSchema>;

interface SeedSummary {
  usersCreated: number;
  usersSkipped: number;
  videosCreated: number;
  videosSkipped: number;
  videosMissing: string[];
  videosFailed: number;
  commentsCreated: number;
  commentsSkipped: number;
  subscriptionsCreated: number;
  subscriptionsSkipped: number;
}

const exitWith = async (code: number): Promise<never> => {
  await mongoose.disconnect().catch(() => {});
  process.exit(code);
};

const loadMetadata = (): SeedData => {
  if (!fs.existsSync(METADATA_PATH)) {
    throw new Error(`metadata.json not found at ${METADATA_PATH}`);
  }
  const raw = fs.readFileSync(METADATA_PATH, 'utf8');
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`metadata.json is not valid JSON: ${message}`);
  }
  const result = seedSchema.safeParse(parsedJson);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`metadata.json failed validation:\n${issues}`);
  }
  return result.data;
};

const ensureUser = async (
  input: { username: string; displayName: string; email: string; bio: string; bannerUrl?: string | null },
  role: 'creator' | 'viewer',
  summary: SeedSummary
): Promise<UserDoc> => {
  const username = input.username.toLowerCase();
  const existing = await User.findOne({ username });
  if (existing) {
    summary.usersSkipped += 1;
    return existing;
  }
  const created = await User.create({
    username,
    email: input.email.toLowerCase(),
    password: DEMO_PASSWORD,
    displayName: input.displayName,
    bio: input.bio,
    role,
    bannerUrl: input.bannerUrl ?? null,
  });
  summary.usersCreated += 1;
  logger.info('seed_demo_user_created', { username: created.username, role });
  return created;
};

const seedVideos = async (
  data: SeedData,
  usersByUsername: Map<string, UserDoc>,
  summary: SeedSummary
): Promise<Map<string, VideoDoc>> => {
  const videosByFile = new Map<string, VideoDoc>();
  let processedCount = 0;

  for (const entry of data.videos) {
    processedCount += 1;
    const progress = `${String(processedCount).padStart(2, '0')}/${String(data.videos.length).padStart(2, '0')}`;
    const author = usersByUsername.get(entry.creator.toLowerCase());

    if (!author) {
      logger.warn('seed_demo_video_skipped_unknown_creator', {
        progress,
        file: entry.file,
        creator: entry.creator,
      });
      continue;
    }

    const existing = await Video.findOne({
      originalFilename: entry.file,
      author: author._id,
    });
    if (existing) {
      // Disk-aware skip: a previous deploy may have written the DB record but
      // failed to finish (or lost) the on-disk artefacts. If the thumbnail or
      // preview is missing, we wipe the stale record + folder so the loop
      // below re-processes the video from scratch instead of leaving the UI
      // with a broken cover image forever.
      const processedDir = path.join(env.UPLOAD_DIR_PROCESSED, existing.videoId);
      const thumbnailExists = fs.existsSync(path.join(processedDir, 'thumbnail.jpg'));
      const previewExists = fs.existsSync(path.join(processedDir, 'preview.mp4'));
      const hlsExists = fs.existsSync(path.join(processedDir, 'index.m3u8'));

      if (existing.status === 'ready' && thumbnailExists && previewExists && hlsExists) {
        summary.videosSkipped += 1;
        videosByFile.set(entry.file, existing);
        logger.info('seed_demo_video_skipped_exists', {
          progress,
          videoId: existing.videoId,
          file: entry.file,
        });
        continue;
      }

      logger.warn('seed_demo_video_reprocessing_stale', {
        progress,
        videoId: existing.videoId,
        file: entry.file,
        reason: {
          status: existing.status,
          thumbnailExists,
          previewExists,
          hlsExists,
        },
      });
      await fs.promises.rm(processedDir, { recursive: true, force: true }).catch(() => {});
      await Video.deleteOne({ _id: existing._id });
    }

    const sourcePath = path.join(VIDEOS_DIR, entry.file);
    if (!fs.existsSync(sourcePath)) {
      summary.videosMissing.push(entry.file);
      logger.warn('seed_demo_video_missing_source', {
        progress,
        file: entry.file,
        sourcePath,
      });
      continue;
    }

    await fs.promises.mkdir(env.UPLOAD_DIR_RAW, { recursive: true });
    const rawFilename = `${nanoid(16)}-${entry.file}`;
    const rawPath = path.join(env.UPLOAD_DIR_RAW, rawFilename);
    await fs.promises.copyFile(sourcePath, rawPath);

    const stat = await fs.promises.stat(rawPath);
    const videoDoc = await Video.create({
      title: entry.title,
      description: entry.description,
      author: author._id,
      tags: entry.tags,
      originalFilename: entry.file,
      fileSize: stat.size,
      visibility: 'public',
      status: 'pending',
    });

    logger.info('seed_demo_video_processing', {
      progress,
      videoId: videoDoc.videoId,
      title: entry.title,
    });

    await processVideo(videoDoc, rawPath);

    const refreshed = await Video.findById(videoDoc._id);
    if (refreshed && refreshed.status === 'ready') {
      summary.videosCreated += 1;
      videosByFile.set(entry.file, refreshed);
      logger.info('seed_demo_video_ready', {
        progress,
        videoId: refreshed.videoId,
        title: refreshed.title,
      });
    } else {
      summary.videosFailed += 1;
      logger.error('seed_demo_video_failed', {
        progress,
        videoId: videoDoc.videoId,
        title: entry.title,
        status: refreshed?.status ?? 'unknown',
        processingError: refreshed?.processingError ?? null,
      });
    }
  }

  return videosByFile;
};

const seedComments = async (
  data: SeedData,
  usersByUsername: Map<string, UserDoc>,
  videosByFile: Map<string, VideoDoc>,
  summary: SeedSummary
): Promise<void> => {
  for (const entry of data.comments) {
    const video = videosByFile.get(entry.video);
    const author = usersByUsername.get(entry.author.toLowerCase());

    if (!video || !author) {
      summary.commentsSkipped += 1;
      logger.warn('seed_demo_comment_skipped_missing_ref', {
        videoFile: entry.video,
        author: entry.author,
        hasVideo: Boolean(video),
        hasAuthor: Boolean(author),
      });
      continue;
    }

    const existing = await Comment.findOne({
      video: video._id,
      author: author._id,
      body: entry.body,
      parent: null,
    }).lean();

    if (existing) {
      summary.commentsSkipped += 1;
      continue;
    }

    await Comment.create({
      video: video._id,
      author: author._id,
      parent: null,
      body: entry.body,
    });

    await Video.updateOne({ _id: video._id }, { $inc: { commentCount: 1 } });
    summary.commentsCreated += 1;
  }
};

const seedSubscriptions = async (
  data: SeedData,
  usersByUsername: Map<string, UserDoc>,
  summary: SeedSummary
): Promise<void> => {
  for (const entry of data.subscriptions) {
    const subscriber = usersByUsername.get(entry.subscriber.toLowerCase());
    const channel = usersByUsername.get(entry.channel.toLowerCase());

    if (!subscriber || !channel) {
      summary.subscriptionsSkipped += 1;
      logger.warn('seed_demo_subscription_skipped_missing_ref', {
        subscriber: entry.subscriber,
        channel: entry.channel,
        hasSubscriber: Boolean(subscriber),
        hasChannel: Boolean(channel),
      });
      continue;
    }

    if (subscriber._id.equals(channel._id)) {
      summary.subscriptionsSkipped += 1;
      logger.warn('seed_demo_subscription_skipped_self', {
        username: subscriber.username,
      });
      continue;
    }

    const existing = await Subscription.findOne({
      subscriber: subscriber._id,
      channel: channel._id,
    }).lean();

    if (existing) {
      summary.subscriptionsSkipped += 1;
      continue;
    }

    await Subscription.create({
      subscriber: subscriber._id,
      channel: channel._id,
    });
    await User.updateOne({ _id: channel._id }, { $inc: { subscriberCount: 1 } });
    summary.subscriptionsCreated += 1;
  }
};

/**
 * Runs the full demo seed pipeline against an already-open Mongo connection.
 *
 * Designed to be called from the long-running app process (so the demo videos
 * are written to the SAME persistent volume the static server reads from), but
 * is also reused by the CLI entrypoint below.
 *
 * Fully idempotent: existing users, videos with all on-disk artefacts present,
 * comments, and subscriptions are skipped. The first run on a fresh volume
 * transcodes 14 videos (~10–15 min); every subsequent boot returns in <2s.
 */
export const runDemoSeed = async (): Promise<SeedSummary> => {
  if (env.isProduction && DEMO_PASSWORD.length < 12) {
    throw new Error('DEMO_PASSWORD must be at least 12 characters in production');
  }

  const data = loadMetadata();

  const summary: SeedSummary = {
    usersCreated: 0,
    usersSkipped: 0,
    videosCreated: 0,
    videosSkipped: 0,
    videosMissing: [],
    videosFailed: 0,
    commentsCreated: 0,
    commentsSkipped: 0,
    subscriptionsCreated: 0,
    subscriptionsSkipped: 0,
  };

  const usersByUsername = new Map<string, UserDoc>();

  for (const creator of data.creators) {
    const userDoc = await ensureUser(creator, 'creator', summary);
    usersByUsername.set(userDoc.username, userDoc);
  }
  for (const viewer of data.viewers) {
    const userDoc = await ensureUser({ ...viewer, bannerUrl: null }, 'viewer', summary);
    usersByUsername.set(userDoc.username, userDoc);
  }

  const videosByFile = await seedVideos(data, usersByUsername, summary);
  await seedComments(data, usersByUsername, videosByFile, summary);
  await seedSubscriptions(data, usersByUsername, summary);

  logger.info('seed_demo_summary', { ...summary });

  if (summary.videosMissing.length > 0) {
    logger.warn('seed_demo_missing_videos', {
      count: summary.videosMissing.length,
      files: summary.videosMissing,
      hint: `Place MP4 files into ${VIDEOS_DIR} and re-run the seed.`,
    });
  }

  return summary;
};

// Detect whether this module is being executed directly as a script (CLI mode)
// versus being imported by the app process. Only the CLI path opens its own DB
// connection and calls process.exit; the in-process variant assumes the caller
// owns the connection lifecycle.
const isCliEntry = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isCliEntry) {
  (async () => {
    try {
      await connectDB();
      const summary = await runDemoSeed();
      await exitWith(summary.videosFailed > 0 ? 1 : 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logger.error('seed_demo_failed', { errorMessage: message, stack });
      await exitWith(1);
    }
  })();
}
