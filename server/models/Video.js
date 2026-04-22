import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const STATUS_VALUES = ['pending', 'processing', 'ready', 'failed'];
const VISIBILITY_VALUES = ['public', 'unlisted'];

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const TAG_MIN = 1;
const TAG_MAX = 24;
const TAGS_MAX_COUNT = 8;

const generateVideoId = () => nanoid(12);

const videoSchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
    status: {
      type: String,
      enum: {
        values: STATUS_VALUES,
        message: 'Invalid status: {VALUE}',
      },
      default: 'pending',
      required: true,
    },
    processingError: {
      type: String,
      default: null,
    },
    hlsPath: {
      type: String,
      default: null,
    },
    thumbnailPath: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, 'Duration cannot be negative'],
    },
    originalFilename: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: 0,
      min: [0, 'File size cannot be negative'],
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    dislikeCount: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (arr) => Array.isArray(arr) && arr.length <= TAGS_MAX_COUNT,
          message: `Tags must contain at most ${TAGS_MAX_COUNT} entries`,
        },
        {
          validator: (arr) =>
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
      enum: {
        values: VISIBILITY_VALUES,
        message: 'Invalid visibility: {VALUE}',
      },
      default: 'public',
      required: true,
    },
    isFlagged: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

videoSchema.pre('validate', function () {
  if (!Array.isArray(this.tags)) return;
  const normalized = this.tags
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean);
  this.tags = [...new Set(normalized)];
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

videoSchema.statics.STATUS_VALUES = STATUS_VALUES;
videoSchema.statics.VISIBILITY_VALUES = VISIBILITY_VALUES;

const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);

export default Video;
