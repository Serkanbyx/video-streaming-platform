import { z } from 'zod';

import { VIDEO_ID_REGEX } from './video.schema.js';

const BODY_MIN = 1;
const BODY_MAX = 1000;

const MONGO_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export const createCommentSchema = z.object({
  videoId: z.string().trim().regex(VIDEO_ID_REGEX, 'Invalid videoId'),
  body: z
    .string()
    .trim()
    .min(BODY_MIN, `Comment body must be between ${BODY_MIN} and ${BODY_MAX} characters`)
    .max(BODY_MAX, `Comment body must be between ${BODY_MIN} and ${BODY_MAX} characters`),
  parent: z.string().regex(MONGO_ID_REGEX, 'parent must be a valid id').optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const editCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(BODY_MIN, `Comment body must be between ${BODY_MIN} and ${BODY_MAX} characters`)
    .max(BODY_MAX, `Comment body must be between ${BODY_MIN} and ${BODY_MAX} characters`),
});
export type EditCommentInput = z.infer<typeof editCommentSchema>;

export const commentIdParamSchema = z.object({
  commentId: z.string().regex(MONGO_ID_REGEX, 'Invalid comment id'),
});
export type CommentIdParam = z.infer<typeof commentIdParamSchema>;
