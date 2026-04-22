import mongoose from 'mongoose';

const BODY_MIN = 1;
const BODY_MAX = 1000;

const commentSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video is required'],
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },
    // null => top-level comment; otherwise => reply to that parent comment.
    // Threads are intentionally limited to a single level of nesting (see
    // `replyCount` denormalization on top-level only and the cross-video
    // forgery check in `createComment`).
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    body: {
      type: String,
      required: [true, 'Body is required'],
      trim: true,
      minlength: [BODY_MIN, `Body must be at least ${BODY_MIN} character`],
      maxlength: [BODY_MAX, `Body must be at most ${BODY_MAX} characters`],
    },
    isEdited: {
      type: Boolean,
      default: false,
      required: true,
    },
    // Soft delete: keeps the document so reply chains and counters stay
    // consistent. Render layer substitutes a placeholder body and hides the
    // author when this is set (see `serializeComment`).
    isDeleted: {
      type: Boolean,
      default: false,
      required: true,
    },
    // Denormalized reply counter on top-level comments only. Maintained by
    // create/delete handlers via `$inc` to avoid an extra aggregation per list.
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Primary access patterns:
//   - listForVideo: { video, parent: null } sort -createdAt
//   - listReplies: { video, parent: <id> } sort +createdAt
// A single compound index covers both with the leading `video` and `parent`
// equality predicates plus a `createdAt` range/sort.
commentSchema.index({ video: 1, parent: 1, createdAt: -1 });

commentSchema.statics.BODY_MIN = BODY_MIN;
commentSchema.statics.BODY_MAX = BODY_MAX;

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

export default Comment;
