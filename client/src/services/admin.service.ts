import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { PaginatedResult } from '@shared/types/api.js';
import type { Video } from '@shared/types/video.js';
import type { AuthUser } from '@shared/types/user.js';
import type {
  AdminComment,
  CleanupReport,
  DashboardStats,
  DiskUsageReport,
} from '@shared/types/admin.js';
import type { CleanupInput } from '@shared/schemas/admin.schema.js';
import type { UserRole } from '@shared/constants/enums.js';

export const getStats = async (): Promise<DashboardStats> => {
  const response = await api.get('/api/admin/dashboard/stats');
  return unwrap<DashboardStats>(response);
};

export const listUsers = async (
  params: Record<string, unknown> = {}
): Promise<PaginatedResult<AuthUser>> => {
  const response = await api.get('/api/admin/users', { params });
  return unwrap<PaginatedResult<AuthUser>>(response);
};

export const setUserRole = async (
  userId: string,
  role: UserRole
): Promise<{ _id: string; username: string; role: UserRole }> => {
  const response = await api.patch(`/api/admin/users/${userId}/role`, { role });
  return unwrap<{ _id: string; username: string; role: UserRole }>(response);
};

export const toggleBan = async (
  userId: string,
  isBanned: boolean
): Promise<{ _id: string; username: string; isBanned: boolean }> => {
  const response = await api.patch(`/api/admin/users/${userId}/ban`, { isBanned });
  return unwrap<{ _id: string; username: string; isBanned: boolean }>(response);
};

export const deleteUser = async (
  userId: string
): Promise<{
  _id: string;
  username: string;
  videosDeleted: number;
  subscriptionsRevoked: number;
}> => {
  const response = await api.delete(`/api/admin/users/${userId}`);
  return unwrap<{
    _id: string;
    username: string;
    videosDeleted: number;
    subscriptionsRevoked: number;
  }>(response);
};

export const listAllVideos = async (
  params: Record<string, unknown> = {}
): Promise<PaginatedResult<Video>> => {
  const response = await api.get('/api/admin/videos', { params });
  return unwrap<PaginatedResult<Video>>(response);
};

export const flagVideo = async (
  videoId: string,
  isFlagged: boolean
): Promise<{ videoId: string; isFlagged: boolean }> => {
  const response = await api.patch(`/api/admin/videos/${videoId}/flag`, { isFlagged });
  return unwrap<{ videoId: string; isFlagged: boolean }>(response);
};

export const adminDeleteVideo = async (videoId: string): Promise<{ videoId: string }> => {
  const response = await api.delete(`/api/admin/videos/${videoId}`);
  return unwrap<{ videoId: string }>(response);
};

export const listAllComments = async (
  params: Record<string, unknown> = {}
): Promise<PaginatedResult<AdminComment>> => {
  const response = await api.get('/api/admin/comments', { params });
  return unwrap<PaginatedResult<AdminComment>>(response);
};

export const adminDeleteComment = async (
  commentId: string
): Promise<{ _id: string; isDeleted: boolean }> => {
  const response = await api.delete(`/api/admin/comments/${commentId}`);
  return unwrap<{ _id: string; isDeleted: boolean }>(response);
};

export const getDiskUsage = async (): Promise<DiskUsageReport> => {
  const response = await api.get('/api/admin/maintenance/disk');
  return unwrap<DiskUsageReport>(response);
};

export const runCleanup = async (
  payload: CleanupInput = {}
): Promise<CleanupReport> => {
  const response = await api.post('/api/admin/maintenance/cleanup', payload);
  return unwrap<CleanupReport>(response);
};
