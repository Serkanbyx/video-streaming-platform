import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { AuthUser, UserPreferences } from '@shared/types/user.js';
import type { ChannelProfile, WatchHistoryEntry } from '@shared/types/video.js';
import type { UpdatePreferencesInput } from '@shared/schemas/user.schema.js';

interface PreferencesPayload {
  preferences: UserPreferences;
  updated?: string[];
}

interface HistoryPayload {
  items: WatchHistoryEntry[];
  total: number;
  limit: number;
}

export const getPublicProfile = async (username: string): Promise<ChannelProfile> => {
  const response = await api.get(`/api/users/${username}`);
  return unwrap<ChannelProfile>(response);
};

export const getPreferences = async (): Promise<PreferencesPayload> => {
  const response = await api.get('/api/users/me/preferences');
  return unwrap<PreferencesPayload>(response);
};

export const updatePreferences = async (
  patch: UpdatePreferencesInput
): Promise<PreferencesPayload> => {
  const response = await api.patch('/api/users/me/preferences', patch);
  return unwrap<PreferencesPayload>(response);
};

export const becomeCreator = async (): Promise<{ user: AuthUser }> => {
  const response = await api.post('/api/users/me/become-creator');
  return unwrap<{ user: AuthUser }>(response);
};

export const watchHistory = async (
  params: Record<string, unknown> = {}
): Promise<HistoryPayload> => {
  const response = await api.get('/api/users/me/history', { params });
  return unwrap<HistoryPayload>(response);
};
