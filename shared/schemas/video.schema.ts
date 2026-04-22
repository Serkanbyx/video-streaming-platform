import { z } from 'zod';

import { VIDEO_SORT_KEYS, VIDEO_VISIBILITIES } from '../constants/enums.js';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const TAG_MIN = 1;
const TAG_MAX = 24;
const TAGS_MAX_COUNT = 8;
const PAGE_SIZE_MAX = 48;
const Q_MAX = 100;
const TAG_QUERY_MAX = 24;

export const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{6,32}$/;

const tagItemSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(TAG_MIN, `Each tag must be between ${TAG_MIN} and ${TAG_MAX} characters`)
  .max(TAG_MAX, `Each tag must be between ${TAG_MIN} and ${TAG_MAX} characters`)
  .regex(
    /^[a-z0-9_-]+$/,
    'Tags may contain only letters, numbers, dashes and underscores'
  );

/**
 * Tags arrive in three shapes (JSON array, multipart array, comma-separated
 * string). We pre-process to a string[] before per-item validation so the
 * downstream consumer sees a consistent type.
 */
const tagsPreprocess = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fallthrough */
    }
  }
  return trimmed
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}, z.array(tagItemSchema).max(TAGS_MAX_COUNT, `Tags must contain at most ${TAGS_MAX_COUNT} entries`));

export const visibilitySchema = z.enum(VIDEO_VISIBILITIES);

export const createVideoSchema = z.object({
  title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).optional().default(''),
  tags: tagsPreprocess.optional(),
  visibility: visibilitySchema.optional(),
});
export type CreateVideoInput = z.infer<typeof createVideoSchema>;

export const updateVideoSchema = z
  .object({
    title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX).optional(),
    description: z.string().trim().max(DESCRIPTION_MAX).optional(),
    tags: tagsPreprocess.optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;

const stringIntPositive = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().int().positive());

export const listVideosQuerySchema = z.object({
  q: z.string().trim().max(Q_MAX).optional(),
  tag: z.string().trim().max(TAG_QUERY_MAX).optional(),
  sort: z.enum(VIDEO_SORT_KEYS).optional(),
  page: stringIntPositive.optional(),
  limit: stringIntPositive.refine((value) => value <= PAGE_SIZE_MAX, {
    message: `limit must be between 1 and ${PAGE_SIZE_MAX}`,
  }).optional(),
});
export type ListVideosQuery = z.infer<typeof listVideosQuerySchema>;

export const videoIdParamSchema = z.object({
  videoId: z.string().regex(VIDEO_ID_REGEX, 'Invalid videoId'),
});
export type VideoIdParam = z.infer<typeof videoIdParamSchema>;

export const recordViewSchema = z.object({
  fingerprint: z.string().uuid('fingerprint must be a valid UUID').optional(),
});
export type RecordViewInput = z.infer<typeof recordViewSchema>;

export const reactionSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});
export type ReactionInput = z.infer<typeof reactionSchema>;
