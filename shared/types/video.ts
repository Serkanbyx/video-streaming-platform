import type { VideoStatus, VideoVisibility } from '../constants/enums.js';
import type { PublicUser } from './user.js';

export interface VideoAuthorRef {
  _id: string;
  username: string;
  displayName: string;
  subscriberCount: number;
  avatarUrl: string | null;
}

export interface Video {
  _id: string;
  videoId: string;
  title: string;
  description: string;
  author: VideoAuthorRef | string;
  status: VideoStatus;
  processingError: string | null;
  hlsPath: string | null;
  thumbnailPath: string | null;
  previewPath: string | null;
  duration: number;
  originalFilename: string | null;
  fileSize: number;
  views: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  tags: string[];
  visibility: VideoVisibility;
  isFlagged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoStatusPayload {
  videoId: string;
  status: VideoStatus;
  processingError: string | null;
}

export interface VideoUploadResult {
  videoId: string;
  status: VideoStatus;
}

export interface ReactionPayload {
  videoId?: string;
  likeCount: number;
  dislikeCount: number;
  myReaction: 0 | 1 | -1;
}

export interface ViewRecord {
  counted: boolean;
  views: number;
}

export interface WatchHistoryEntry {
  viewedAt: string;
  video: Video;
}

export interface ChannelProfile extends PublicUser {}
