import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const register = async (payload) => {
  const response = await api.post('/api/auth/register', payload);
  return unwrap(response);
};

export const login = async (credentials) => {
  const response = await api.post('/api/auth/login', credentials);
  return unwrap(response);
};

export const getMe = async () => {
  const response = await api.get('/api/auth/me');
  return unwrap(response);
};

export const updateProfile = async (patch) => {
  const response = await api.patch('/api/auth/me', patch);
  return unwrap(response);
};

export const changePassword = async (payload) => {
  const response = await api.post('/api/auth/change-password', payload);
  return unwrap(response);
};

export const deleteAccount = async (payload) => {
  const response = await api.delete('/api/auth/me', { data: payload });
  return unwrap(response);
};
