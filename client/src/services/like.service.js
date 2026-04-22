import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const setReaction = async (videoId, value) => {
  const response = await api.post(`/api/likes/${videoId}`, { value });
  return unwrap(response);
};

export const removeReaction = async (videoId) => {
  const response = await api.delete(`/api/likes/${videoId}`);
  return unwrap(response);
};

export const getMyReaction = async (videoId) => {
  const response = await api.get(`/api/likes/${videoId}/me`);
  return unwrap(response);
};
