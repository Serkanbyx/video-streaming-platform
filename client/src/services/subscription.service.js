import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const subscribe = async (channelId) => {
  const response = await api.post(`/api/subscriptions/${channelId}`);
  return unwrap(response);
};

export const unsubscribe = async (channelId) => {
  const response = await api.delete(`/api/subscriptions/${channelId}`);
  return unwrap(response);
};

export const myChannels = async () => {
  const response = await api.get('/api/subscriptions/me');
  return unwrap(response);
};

export const subscriptionFeed = async (params = {}) => {
  const response = await api.get('/api/subscriptions/me/feed', { params });
  return unwrap(response);
};

export const isSubscribed = async (channelId) => {
  const response = await api.get(`/api/subscriptions/${channelId}/status`);
  return unwrap(response);
};
