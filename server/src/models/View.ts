import mongoose, { Schema, Types, type HydratedDocument, type Model } from 'mongoose';

const { model, models } = mongoose;

const FINGERPRINT_MIN = 8;
const FINGERPRINT_MAX = 64;

const viewSchema = new Schema(
  {
    video: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fingerprint: {
      type: String,
      required: [true, 'Fingerprint is required'],
      trim: true,
      minlength: [FINGERPRINT_MIN, `Fingerprint must be at least ${FINGERPRINT_MIN} characters`],
      maxlength: [FINGERPRINT_MAX, `Fingerprint must be at most ${FINGERPRINT_MAX} characters`],
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

viewSchema.index({ video: 1, user: 1, createdAt: -1 });
viewSchema.index({ video: 1, fingerprint: 1, createdAt: -1 });
viewSchema.index({ user: 1, createdAt: -1 });

export type ViewDoc = HydratedDocument<{
  video: Types.ObjectId;
  user: Types.ObjectId | null;
  fingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ViewModel = Model<ViewDoc>;

const View = (models.View as ViewModel) || model<ViewDoc>('View', viewSchema);

export default View;
