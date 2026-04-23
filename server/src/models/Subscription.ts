import mongoose, { Schema, Types, type HydratedDocument, type Model } from 'mongoose';

const { model, models } = mongoose;

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Subscriber is required'],
      index: true,
    },
    channel: {
      type: Schema.Types.ObjectId,
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
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

subscriptionSchema.index({ subscriber: 1, channel: 1 }, { unique: true });

export type SubscriptionDoc = HydratedDocument<{
  subscriber: Types.ObjectId;
  channel: Types.ObjectId;
  createdAt: Date;
}>;

export type SubscriptionModel = Model<SubscriptionDoc>;

const Subscription =
  (models.Subscription as SubscriptionModel) ||
  model<SubscriptionDoc>('Subscription', subscriptionSchema);

export default Subscription;
