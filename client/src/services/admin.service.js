import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const getStats = async () => {
  const response = await api.get('/api/admin/dashboard/stats');
  return unwrap(response);
};

export const listUsers = async (params = {}) => {
  const response = await api.get('/api/admin/users', { params });
  return unwrap(response);
};

export const setUserRole = async (userId, role) => {
  const response = await api.patch(`/api/admin/users/${userId}/role`, { role });
  return unwrap(response);
};

export const toggleBan = async (userId, isBanned) => {
  const response = await api.patch(`/api/admin/users/${userId}/ban`, { isBanned });
  return unwrap(response);
};

export const deleteUser = async (userId) => {
  const response = await api.delete(`/api/admin/users/${userId}`);
  return unwrap(response);
};

export const listAllVideos = async (params = {}) => {
  const response = await api.get('/api/admin/videos', { params });
  return unwrap(response);
};

export const flagVideo = async (videoId, isFlagged) => {
  const response = await api.patch(`/api/admin/videos/${videoId}/flag`, { isFlagged });
  return unwrap(response);
};

export const adminDeleteVideo = async (videoId) => {
  const response = await api.delete(`/api/admin/videos/${videoId}`);
  return unwrap(response);
};

export const listAllComments = async (params = {}) => {
  const response = await api.get('/api/admin/comments', { params });
  return unwrap(response);
};

export const adminDeleteComment = async (commentId) => {
  const response = await api.delete(`/api/admin/comments/${commentId}`);
  return unwrap(response);
};

export const getDiskUsage = async () => {
  const response = await api.get('/api/admin/maintenance/disk');
  return unwrap(response);
};

export const runCleanup = async (payload = {}) => {
  const response = await api.post('/api/admin/maintenance/cleanup', payload);
  return unwrap(response);
};
