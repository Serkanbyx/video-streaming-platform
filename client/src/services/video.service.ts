import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { PaginatedResult } from '@shared/types/api.js';
import type {
  Video,
  VideoStatusPayload,
  VideoUploadResult,
  ViewRecord,
} from '@shared/types/video.js';

interface ListVideosParams {
  q?: string;
  tag?: string;
  sort?: 'new' | 'top' | 'liked';
  page?: number;
  limit?: number;
}

interface UploadFields {
  title: string;
  description?: string;
  visibility?: 'public' | 'unlisted';
  tags?: string[] | string;
}

interface UploadOptions {
  onUploadProgress?: (event: ProgressEvent | { loaded: number; total?: number }) => void;
}

export const listVideos = async (
  params: ListVideosParams = {}
): Promise<PaginatedResult<Video>> => {
  const response = await api.get('/api/videos', { params });
  return unwrap<PaginatedResult<Video>>(response);
};

export const getVideo = async (videoId: string): Promise<Video> => {
  const response = await api.get(`/api/videos/${videoId}`);
  return unwrap<Video>(response);
};

export const getStatus = async (videoId: string): Promise<VideoStatusPayload> => {
  const response = await api.get(`/api/videos/${videoId}/status`);
  return unwrap<VideoStatusPayload>(response);
};

export const getMyVideos = async (
  params: ListVideosParams = {}
): Promise<PaginatedResult<Video>> => {
  const response = await api.get('/api/videos/mine', { params });
  return unwrap<PaginatedResult<Video>>(response);
};

export const getByChannel = async (
  userId: string,
  params: ListVideosParams = {}
): Promise<PaginatedResult<Video>> => {
  const response = await api.get(`/api/videos/by-channel/${userId}`, { params });
  return unwrap<PaginatedResult<Video>>(response);
};

export const getRecommendations = async (
  videoId: string
): Promise<{ items: Video[]; limit: number }> => {
  const response = await api.get(`/api/videos/${videoId}/recommendations`);
  return unwrap<{ items: Video[]; limit: number }>(response);
};

export const updateVideo = async (
  videoId: string,
  patch: Partial<Pick<Video, 'title' | 'description' | 'visibility' | 'tags'>>
): Promise<Video> => {
  const response = await api.patch(`/api/videos/${videoId}`, patch);
  return unwrap<Video>(response);
};

export const deleteVideo = async (videoId: string): Promise<{ videoId: string }> => {
  const response = await api.delete(`/api/videos/${videoId}`);
  return unwrap<{ videoId: string }>(response);
};

export const recordView = async (
  videoId: string,
  body: { fingerprint?: string } = {}
): Promise<ViewRecord> => {
  const response = await api.patch(`/api/videos/${videoId}/view`, body);
  return unwrap<ViewRecord>(response);
};

/**
 * Multipart upload. `fields` carries the metadata; `file` is the raw File
 * blob. The backend expects the binary on the `video` field. The optional
 * `onUploadProgress` callback receives axios's native `ProgressEvent` so the
 * caller can drive a progress bar without re-implementing the math.
 */
export const uploadVideo = async (
  fields: UploadFields,
  file: File,
  { onUploadProgress }: UploadOptions = {}
): Promise<VideoUploadResult> => {
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
    onUploadProgress: onUploadProgress as never,
  });
  return unwrap<VideoUploadResult>(response);
};
