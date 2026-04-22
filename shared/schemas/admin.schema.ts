import { z } from 'zod';

import { USER_ROLES } from '../constants/enums.js';

const MONGO_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export const setRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});
export type SetRoleInput = z.infer<typeof setRoleSchema>;

export const toggleBanSchema = z.object({
  isBanned: z.boolean(),
});
export type ToggleBanInput = z.infer<typeof toggleBanSchema>;

export const flagVideoSchema = z.object({
  isFlagged: z.boolean(),
});
export type FlagVideoInput = z.infer<typeof flagVideoSchema>;

export const cleanupSchema = z.object({
  failedOlderThanDays: z.number().int().min(1).max(365).optional(),
  dryRun: z.boolean().optional(),
});
export type CleanupInput = z.infer<typeof cleanupSchema>;

export const userIdParamSchema = z.object({
  userId: z.string().regex(MONGO_ID_REGEX, 'Invalid user id'),
});
export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const adminCommentIdParamSchema = z.object({
  commentId: z.string().regex(MONGO_ID_REGEX, 'Invalid comment id'),
});
export type AdminCommentIdParam = z.infer<typeof adminCommentIdParamSchema>;
