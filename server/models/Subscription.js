import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Subscriber is required'],
      index: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Channel is required'],
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

// Unique pair guarantees one subscription per (subscriber, channel) at the DB
// level. Concurrent POSTs racing past the application-level findOne check are
// rejected with E11000 and treated as a no-op success in the controller.
subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

const Subscription =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
