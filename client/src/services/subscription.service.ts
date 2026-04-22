import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { PaginatedResult } from '@shared/types/api.js';
import type { SubscriptionEntry, SubscriptionStatus } from '@shared/types/subscription.js';
import type { Video } from '@shared/types/video.js';

export const subscribe = async (channelId: string): Promise<SubscriptionStatus> => {
  const response = await api.post(`/api/subscriptions/${channelId}`);
  return unwrap<SubscriptionStatus>(response);
};

export const unsubscribe = async (channelId: string): Promise<SubscriptionStatus> => {
  const response = await api.delete(`/api/subscriptions/${channelId}`);
  return unwrap<SubscriptionStatus>(response);
};

export const myChannels = async (): Promise<PaginatedResult<SubscriptionEntry>> => {
  const response = await api.get('/api/subscriptions/me');
  return unwrap<PaginatedResult<SubscriptionEntry>>(response);
};

export const subscriptionFeed = async (
  params: Record<string, unknown> = {}
): Promise<PaginatedResult<Video>> => {
  const response = await api.get('/api/subscriptions/me/feed', { params });
  return unwrap<PaginatedResult<Video>>(response);
};

export const isSubscribed = async (channelId: string): Promise<SubscriptionStatus> => {
  const response = await api.get(`/api/subscriptions/${channelId}/status`);
  return unwrap<SubscriptionStatus>(response);
};
