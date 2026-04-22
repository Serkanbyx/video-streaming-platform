import mongoose from 'mongoose';

const REACTION_VALUES = [1, -1];

const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
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
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Unique reaction per (user, video): the DB itself blocks double-likes and
// makes upsert/toggle semantics safe under concurrent requests.
likeSchema.index({ user: 1, video: 1 }, { unique: true });

likeSchema.statics.REACTION_VALUES = REACTION_VALUES;

const Like = mongoose.models.Like || mongoose.model('Like', likeSchema);

export default Like;
