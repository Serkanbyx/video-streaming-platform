import { Schema, Types, model, models, type HydratedDocument, type Model } from 'mongoose';

import { REACTION_VALUES, type ReactionValue } from '@shared/constants/enums.js';

const likeSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video is required'],
      index: true,
    },
    value: {
      type: Number,
      enum: {
        values: REACTION_VALUES,
        message: 'Reaction value must be 1 (like) or -1 (dislike)',
      },
      required: [true, 'Reaction value is required'],
    },
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

likeSchema.index({ user: 1, video: 1 }, { unique: true });

export type LikeDoc = HydratedDocument<{
  user: Types.ObjectId;
  video: Types.ObjectId;
  value: ReactionValue;
  createdAt: Date;
  updatedAt: Date;
}>;

export type LikeModel = Model<LikeDoc>;

const Like = (models.Like as LikeModel) || model<LikeDoc>('Like', likeSchema);

export default Like;
