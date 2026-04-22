import mongoose from 'mongoose';

const FINGERPRINT_MIN = 8;
const FINGERPRINT_MAX = 64;

const viewSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
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
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Dedup window lookups: most recent view per (video, identity) tuple.
viewSchema.index({ video: 1, user: 1, createdAt: -1 });
viewSchema.index({ video: 1, fingerprint: 1, createdAt: -1 });

// Watch history aggregation: latest distinct videos per user.
viewSchema.index({ user: 1, createdAt: -1 });

const View = mongoose.models.View || mongoose.model('View', viewSchema);

export default View;
