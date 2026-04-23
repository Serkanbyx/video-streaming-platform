import type { VideoStatus } from '../constants/enums.js';
import type { Video } from './video.js';
import type { Comment } from './comment.js';

export type DiskAlertLevel = 'ok' | 'warn' | 'critical';

export interface DiskUsageReport {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  videoCount: number;
  rawCount: number;
  dbVideoCount: number;
  orphanFolderCount: number;
  dbOrphanCount: number;
  quotaMb: number;
  alertLevel: DiskAlertLevel;
}

export interface CleanupReport {
  dryRun: boolean;
  failedVideosDeleted: number;
  orphanFoldersDeleted: number;
  missingHlsMarkedFailed: number;
  staleRawDeleted: number;
  bytesFreed: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalVideos: number;
  totalViews: number;
  totalComments: number;
  newUsersLast7Days: number;
  videosByStatus: Record<VideoStatus, number>;
  topVideosByViews: Video[];
}

export interface AdminCommentVideoRef {
  _id: string;
  videoId: string;
  title: string;
}

export interface AdminComment extends Omit<Comment, 'video'> {
  video: AdminCommentVideoRef | string;
}
