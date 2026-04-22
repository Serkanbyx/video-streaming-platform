import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { ReactionPayload } from '@shared/types/video.js';
import type { ReactionValue } from '@shared/constants/enums.js';

export const setReaction = async (
  videoId: string,
  value: ReactionValue
): Promise<ReactionPayload> => {
  const response = await api.post(`/api/likes/${videoId}`, { value });
  return unwrap<ReactionPayload>(response);
};

export const removeReaction = async (videoId: string): Promise<ReactionPayload> => {
  const response = await api.delete(`/api/likes/${videoId}`);
  return unwrap<ReactionPayload>(response);
};

export const getMyReaction = async (videoId: string): Promise<ReactionPayload> => {
  const response = await api.get(`/api/likes/${videoId}/me`);
  return unwrap<ReactionPayload>(response);
};
