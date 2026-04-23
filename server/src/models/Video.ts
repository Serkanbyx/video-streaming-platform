import mongoose, { Schema, Types, type HydratedDocument, type Model } from 'mongoose';

const { model, models } = mongoose;
import { nanoid } from 'nanoid';

import {
  VIDEO_STATUSES,
  VIDEO_VISIBILITIES,
  type VideoStatus,
  type VideoVisibility,
} from '@shared/constants/enums.js';

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const TAG_MIN = 1;
const TAG_MAX = 24;
const TAGS_MAX_COUNT = 8;

const generateVideoId = (): string => nanoid(12);

const videoSchema = new Schema(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      default: generateVideoId,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [TITLE_MIN, `Title must be at least ${TITLE_MIN} characters`],
      maxlength: [TITLE_MAX, `Title must be at most ${TITLE_MAX} characters`],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [DESCRIPTION_MAX, `Description must be at most ${DESCRIPTION_MAX} characters`],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    status: {
      type: String,
      enum: { values: VIDEO_STATUSES, message: 'Invalid status: {VALUE}' },
      default: 'pending' satisfies VideoStatus,
      required: true,
    },
    processingError: { type: String, default: null },
    hlsPath: { type: String, default: null },
    thumbnailPath: { type: String, default: null },
    previewPath: { type: String, default: null },
    duration: { type: Number, default: 0, min: [0, 'Duration cannot be negative'] },
    originalFilename: { type: String, default: null },
    fileSize: { type: Number, default: 0, min: [0, 'File size cannot be negative'] },
    views: { type: Number, default: 0, min: 0, required: true },
    likeCount: { type: Number, default: 0, min: 0, required: true },
    dislikeCount: { type: Number, default: 0, min: 0, required: true },
    commentCount: { type: Number, default: 0, min: 0, required: true },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr: unknown) => Array.isArray(arr) && arr.length <= TAGS_MAX_COUNT,
          message: `Tags must contain at most ${TAGS_MAX_COUNT} entries`,
        },
        {
          validator: (arr: unknown) =>
            Array.isArray(arr) &&
            arr.every(
              (tag) =>
                typeof tag === 'string' && tag.length >= TAG_MIN && tag.length <= TAG_MAX
            ),
          message: `Each tag must be between ${TAG_MIN} and ${TAG_MAX} characters`,
        },
      ],
    },
    visibility: {
      type: String,
      enum: { values: VIDEO_VISIBILITIES, message: 'Invalid visibility: {VALUE}' },
      default: 'public' satisfies VideoVisibility,
      required: true,
    },
    isFlagged: { type: Boolean, default: false, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

videoSchema.pre('validate', function () {
  const tags = this.get('tags');
  if (!Array.isArray(tags)) return;
  const normalized = tags
    .map((tag: unknown) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean) as string[];
  this.set('tags', [...new Set(normalized)]);
});

videoSchema.index({ author: 1, createdAt: -1 });
videoSchema.index({ status: 1 });
videoSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  {
    weights: { title: 10, tags: 5, description: 1 },
    name: 'video_text_index',
  }
);

export type VideoDoc = HydratedDocument<{
  videoId: string;
  title: string;
  description: string;
  author: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}>;

export type VideoModel = Model<VideoDoc>;

const Video = (models.Video as VideoModel) || model<VideoDoc>('Video', videoSchema);

export default Video;
