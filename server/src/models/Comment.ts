import mongoose, { Schema, Types, type HydratedDocument, type Model } from 'mongoose';

const { model, models } = mongoose;

const BODY_MIN = 1;
const BODY_MAX = 1000;

const commentSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video is required'],
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
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
    isEdited: { type: Boolean, default: false, required: true },
    isDeleted: { type: Boolean, default: false, required: true },
    replyCount: { type: Number, default: 0, min: 0, required: true },
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

commentSchema.index({ video: 1, parent: 1, createdAt: -1 });

export const COMMENT_BODY_MIN = BODY_MIN;
export const COMMENT_BODY_MAX = BODY_MAX;

export type CommentDoc = HydratedDocument<{
  video: Types.ObjectId;
  author: Types.ObjectId;
  parent: Types.ObjectId | null;
  body: string;
  isEdited: boolean;
  isDeleted: boolean;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CommentModel = Model<CommentDoc>;

const Comment = (models.Comment as CommentModel) || model<CommentDoc>('Comment', commentSchema);

export default Comment;
