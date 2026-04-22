import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const listForVideo = async (videoId, params = {}) => {
  const response = await api.get(`/api/comments/video/${videoId}`, { params });
  return unwrap(response);
};

export const listReplies = async (commentId, params = {}) => {
  const response = await api.get(`/api/comments/${commentId}/replies`, { params });
  return unwrap(response);
};

export const createComment = async (payload) => {
  const response = await api.post('/api/comments', payload);
  return unwrap(response);
};

export const editComment = async (commentId, patch) => {
  const response = await api.patch(`/api/comments/${commentId}`, patch);
  return unwrap(response);
};

export const deleteComment = async (commentId) => {
  const response = await api.delete(`/api/comments/${commentId}`);
  return unwrap(response);
};
