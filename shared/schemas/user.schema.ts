import { z } from 'zod';

import {
  PREFERENCE_ACCENTS,
  PREFERENCE_ANIMATIONS,
  PREFERENCE_DENSITIES,
  PREFERENCE_FONT_SIZES,
  PREFERENCE_LANGUAGES,
  PREFERENCE_THEMES,
} from '../constants/enums.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

export const usernameParamSchema = z.object({
  username: z.string().regex(USERNAME_REGEX, 'Invalid username'),
});
export type UsernameParam = z.infer<typeof usernameParamSchema>;

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(48).optional(),
    bio: z.string().trim().max(280).optional(),
    bannerUrl: z
      .string()
      .url('bannerUrl must be a valid http(s) URL')
      .max(2048, 'bannerUrl is too long')
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(PREFERENCE_THEMES).optional(),
    accentColor: z.enum(PREFERENCE_ACCENTS).optional(),
    fontSize: z.enum(PREFERENCE_FONT_SIZES).optional(),
    density: z.enum(PREFERENCE_DENSITIES).optional(),
    animations: z.enum(PREFERENCE_ANIMATIONS).optional(),
    scanlines: z.boolean().optional(),
    language: z.enum(PREFERENCE_LANGUAGES).optional(),
    privacy: z
      .object({
        showEmail: z.boolean().optional(),
        showHistory: z.boolean().optional(),
        showSubscriptions: z.boolean().optional(),
      })
      .partial()
      .optional(),
    notifications: z
      .object({
        newSubscriber: z.boolean().optional(),
        newComment: z.boolean().optional(),
      })
      .partial()
      .optional(),
    content: z
      .object({
        autoplay: z.boolean().optional(),
        defaultVolume: z.number().min(0).max(1).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
