import type {
  PreferenceAccent,
  PreferenceAnimation,
  PreferenceDensity,
  PreferenceFontSize,
  PreferenceLanguage,
  PreferenceTheme,
  UserRole,
} from '../constants/enums.js';

export interface UserPreferencesPrivacy {
  showEmail: boolean;
  showHistory: boolean;
  showSubscriptions: boolean;
}

export interface UserPreferencesNotifications {
  newSubscriber: boolean;
  newComment: boolean;
}

export interface UserPreferencesContent {
  autoplay: boolean;
  defaultVolume: number;
}

export interface UserPreferences {
  theme: PreferenceTheme;
  accentColor: PreferenceAccent;
  fontSize: PreferenceFontSize;
  density: PreferenceDensity;
  animations: PreferenceAnimation;
  scanlines: boolean;
  language: PreferenceLanguage;
  privacy: UserPreferencesPrivacy;
  notifications: UserPreferencesNotifications;
  content: UserPreferencesContent;
}

export interface PublicUser {
  _id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  totalViews: number;
  createdAt: string;
}

export interface AuthUser extends PublicUser {
  email: string;
  role: UserRole;
  isBanned: boolean;
  preferences?: UserPreferences;
  lastLoginAt?: string | null;
  updatedAt?: string;
}

export interface AuthPayload {
  user: AuthUser;
  token: string;
}
