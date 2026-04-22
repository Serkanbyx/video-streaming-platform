import api from '../api/axios.js';

const unwrap = (response) => response.data?.data ?? response.data;

export const listVideos = async (params = {}) => {
  const response = await api.get('/api/videos', { params });
  return unwrap(response);
};

export const getVideo = async (videoId) => {
  const response = await api.get(`/api/videos/${videoId}`);
  return unwrap(response);
};

export const getStatus = async (videoId) => {
  const response = await api.get(`/api/videos/${videoId}/status`);
  return unwrap(response);
};

export const getMyVideos = async (params = {}) => {
  const response = await api.get('/api/videos/mine', { params });
  return unwrap(response);
};

export const getByChannel = async (userId, params = {}) => {
  const response = await api.get(`/api/videos/by-channel/${userId}`, { params });
  return unwrap(response);
};

export const getRecommendations = async (videoId) => {
  const response = await api.get(`/api/videos/${videoId}/recommendations`);
  return unwrap(response);
};

export const updateVideo = async (videoId, patch) => {
  const response = await api.patch(`/api/videos/${videoId}`, patch);
  return unwrap(response);
};

export const deleteVideo = async (videoId) => {
  const response = await api.delete(`/api/videos/${videoId}`);
  return unwrap(response);
};

export const recordView = async (videoId, body = {}) => {
  const response = await api.patch(`/api/videos/${videoId}/view`, body);
  return unwrap(response);
};

/**
 * Multipart upload. `fields` carries the metadata; `file` is the raw File
 * blob. The backend expects the binary on the `video` field. The optional
 * `onUploadProgress` callback receives axios's native `ProgressEvent` so the
 * caller can drive a progress bar without re-implementing the math.
 */
export const uploadVideo = async (fields, file, { onUploadProgress } = {}) => {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('title', fields.title);
  if (fields.description) formData.append('description', fields.description);
  if (fields.visibility) formData.append('visibility', fields.visibility);
  if (Array.isArray(fields.tags)) {
    fields.tags.forEach((tag) => formData.append('tags', tag));
  } else if (typeof fields.tags === 'string' && fields.tags.length > 0) {
    formData.append('tags', fields.tags);
  }

  const response = await api.post('/api/videos/upload', formData, {
    onUploadProgress,
  });
  return unwrap(response);
};
