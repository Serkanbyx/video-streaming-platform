import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const getPublicProfile = async (username) => {
  const response = await api.get(`/api/users/${username}`);
  return unwrap(response);
};

export const getPreferences = async () => {
  const response = await api.get('/api/users/me/preferences');
  return unwrap(response);
};

export const updatePreferences = async (patch) => {
  const response = await api.patch('/api/users/me/preferences', patch);
  return unwrap(response);
};

export const becomeCreator = async () => {
  const response = await api.post('/api/users/me/become-creator');
  return unwrap(response);
};

export const watchHistory = async (params = {}) => {
  const response = await api.get('/api/users/me/history', { params });
  return unwrap(response);
};
