import type { PublicUser } from './user.js';

export interface SubscriptionEntry {
  subscribedAt: string;
  channel: PublicUser & { bannerUrl: string | null; videoCount: number };
}

export interface SubscriptionStatus {
  channelId: string;
  isSubscribed: boolean;
  subscriberCount: number;
}
