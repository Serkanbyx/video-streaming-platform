/**
 * Converts video documents into a client-ready shape by translating the
 * stored `processed/<videoId>/...` filesystem paths into root-relative
 * `/api/stream/<videoId>/...` URLs that map to the static HLS route mounted
 * in `server/index.js`.
 *
 * The DB intentionally stores filesystem paths (so cleanup/migration scripts
 * stay simple) — URL shaping is a presentation concern and lives here.
 *
 * Idempotent: already-public values (absolute http(s) URLs or paths that
 * already start with the stream base) are returned unchanged so the
 * serializer can safely run on already-serialized data without corruption.
 */

const STREAM_BASE = '/api/stream';
const PROCESSED_PREFIX = 'processed/';

const isAlreadyPublicUrl = (value) => {
  if (typeof value !== 'string' || !value) return false;
  if (/^(https?:)?\/\//i.test(value)) return true;
  return value.startsWith(`${STREAM_BASE}/`);
};

const toStreamUrl = (storedPath) => {
  if (typeof storedPath !== 'string' || !storedPath) return null;
  if (isAlreadyPublicUrl(storedPath)) return storedPath;

  const normalized = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');
  const relative = normalized.startsWith(PROCESSED_PREFIX)
    ? normalized.slice(PROCESSED_PREFIX.length)
    : normalized;

  return `${STREAM_BASE}/${relative}`;
};

const toPlainObject = (input) => {
  if (!input || typeof input !== 'object') return input;
  if (typeof input.toObject === 'function') return input.toObject({ virtuals: true });
  return { ...input };
};

export const serializeVideo = (video) => {
  if (!video || typeof video !== 'object') return video;

  const result = toPlainObject(video);

  if (result.hlsPath) result.hlsPath = toStreamUrl(result.hlsPath);
  if (result.thumbnailPath) result.thumbnailPath = toStreamUrl(result.thumbnailPath);

  return result;
};

export const serializeVideos = (videos) =>
  Array.isArray(videos) ? videos.map(serializeVideo) : videos;
