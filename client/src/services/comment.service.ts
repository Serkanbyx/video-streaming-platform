import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { PaginatedResult } from '@shared/types/api.js';
import type { Comment } from '@shared/types/comment.js';
import type {
  CreateCommentInput,
  EditCommentInput,
} from '@shared/schemas/comment.schema.js';

export const listForVideo = async (
  videoId: string,
  params: Record<string, unknown> = {}
): Promise<PaginatedResult<Comment>> => {
  const response = await api.get(`/api/comments/video/${videoId}`, { params });
  return unwrap<PaginatedResult<Comment>>(response);
};

export const listReplies = async (
  commentId: string,
  params: Record<string, unknown> = {}
): Promise<PaginatedResult<Comment>> => {
  const response = await api.get(`/api/comments/${commentId}/replies`, { params });
  return unwrap<PaginatedResult<Comment>>(response);
};

export const createComment = async (payload: CreateCommentInput): Promise<Comment> => {
  const response = await api.post('/api/comments', payload);
  return unwrap<Comment>(response);
};

export const editComment = async (
  commentId: string,
  patch: EditCommentInput
): Promise<Comment> => {
  const response = await api.patch(`/api/comments/${commentId}`, patch);
  return unwrap<Comment>(response);
};

export const deleteComment = async (commentId: string): Promise<Comment> => {
  const response = await api.delete(`/api/comments/${commentId}`);
  return unwrap<Comment>(response);
};
