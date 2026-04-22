/**
 * Converts video documents into a client-ready shape by translating the
 * stored `processed/<videoId>/...` filesystem paths into root-relative
 * `/api/stream/<videoId>/...` URLs that map to the static HLS route mounted
 * in `server/src/index.ts`.
 *
 * Idempotent: already-public values (absolute http(s) URLs or paths that
 * already start with the stream base) are returned unchanged.
 */

const STREAM_BASE = '/api/stream';
const PROCESSED_PREFIX = 'processed/';

const isAlreadyPublicUrl = (value: string): boolean => {
  if (!value) return false;
  if (/^(https?:)?\/\//i.test(value)) return true;
  return value.startsWith(`${STREAM_BASE}/`);
};

const toStreamUrl = (storedPath: unknown): string | null => {
  if (typeof storedPath !== 'string' || !storedPath) return null;
  if (isAlreadyPublicUrl(storedPath)) return storedPath;

  const normalized = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const relative = normalized.startsWith(PROCESSED_PREFIX)
    ? normalized.slice(PROCESSED_PREFIX.length)
    : normalized;

  return `${STREAM_BASE}/${relative}`;
};

interface MaybeMongoDoc {
  toObject?: (options?: Record<string, unknown>) => Record<string, unknown>;
}

const toPlainObject = <T extends object>(input: T): Record<string, unknown> => {
  const candidate = input as T & MaybeMongoDoc;
  if (typeof candidate.toObject === 'function') {
    return candidate.toObject({ virtuals: true });
  }
  return { ...(input as unknown as Record<string, unknown>) };
};

export interface SerializedVideo extends Record<string, unknown> {
  hlsPath: string | null;
  thumbnailPath: string | null;
}

export const serializeVideo = <T extends object>(video: T | null | undefined): SerializedVideo | T | null | undefined => {
  if (!video || typeof video !== 'object') return video;

  const result = toPlainObject(video) as SerializedVideo;

  if (result.hlsPath) result.hlsPath = toStreamUrl(result.hlsPath);
  if (result.thumbnailPath) result.thumbnailPath = toStreamUrl(result.thumbnailPath);

  return result;
};

export const serializeVideos = <T extends object>(videos: T[] | null | undefined): unknown[] | null | undefined =>
  Array.isArray(videos) ? videos.map((v) => serializeVideo(v)) : videos;
