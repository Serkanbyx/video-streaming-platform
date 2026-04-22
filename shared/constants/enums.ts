export const USER_ROLES = ['viewer', 'creator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VIDEO_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const VIDEO_VISIBILITIES = ['public', 'unlisted'] as const;
export type VideoVisibility = (typeof VIDEO_VISIBILITIES)[number];

export const REACTION_VALUES = [1, -1] as const;
export type ReactionValue = (typeof REACTION_VALUES)[number];

export const PREFERENCE_THEMES = ['light', 'dark', 'system'] as const;
export type PreferenceTheme = (typeof PREFERENCE_THEMES)[number];

export const PREFERENCE_ACCENTS = ['acid', 'magenta', 'electric', 'orange'] as const;
export type PreferenceAccent = (typeof PREFERENCE_ACCENTS)[number];

export const PREFERENCE_FONT_SIZES = ['sm', 'md', 'lg'] as const;
export type PreferenceFontSize = (typeof PREFERENCE_FONT_SIZES)[number];

export const PREFERENCE_DENSITIES = ['compact', 'comfortable'] as const;
export type PreferenceDensity = (typeof PREFERENCE_DENSITIES)[number];

export const PREFERENCE_ANIMATIONS = ['full', 'reduced', 'off'] as const;
export type PreferenceAnimation = (typeof PREFERENCE_ANIMATIONS)[number];

export const PREFERENCE_LANGUAGES = ['en'] as const;
export type PreferenceLanguage = (typeof PREFERENCE_LANGUAGES)[number];

export const VIDEO_SORT_KEYS = ['new', 'top', 'liked'] as const;
export type VideoSortKey = (typeof VIDEO_SORT_KEYS)[number];

export const USER_SORT_KEYS = ['newest', 'oldest', 'username'] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];
