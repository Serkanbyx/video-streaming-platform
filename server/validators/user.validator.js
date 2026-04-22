import { body, param } from 'express-validator';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,24}$/;

const THEME_VALUES = ['light', 'dark', 'system'];
const ACCENT_VALUES = ['acid', 'magenta', 'electric', 'orange'];
const FONT_SIZE_VALUES = ['sm', 'md', 'lg'];
const DENSITY_VALUES = ['compact', 'comfortable'];
const ANIMATION_VALUES = ['full', 'reduced', 'off'];
const LANGUAGE_VALUES = ['en'];

export const updateProfileRules = [
  body('displayName')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('displayName must be a string')
    .bail()
    .trim()
    .isLength({ min: 1, max: 48 })
    .withMessage('displayName must be between 1 and 48 characters')
    .escape(),

  body('bio')
    .optional({ values: 'undefined' })
    .isString()
    .withMessage('bio must be a string')
    .bail()
    .trim()
    .isLength({ max: 280 })
    .withMessage('bio must be at most 280 characters')
    .escape(),

  body('bannerUrl')
    .optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('bannerUrl must be a valid http(s) URL')
    .isLength({ max: 2048 })
    .withMessage('bannerUrl is too long'),
];

/**
 * Each preference path is validated independently with `.optional()` so the
 * request can carry any subset of fields. The controller's own whitelist
 * silently drops unknown keys; this layer guarantees that recognised keys
 * arrive in the correct shape.
 */
export const updatePreferencesRules = [
  body('theme')
    .optional()
    .isIn(THEME_VALUES)
    .withMessage(`theme must be one of: ${THEME_VALUES.join(', ')}`),

  body('accentColor')
    .optional()
    .isIn(ACCENT_VALUES)
    .withMessage(`accentColor must be one of: ${ACCENT_VALUES.join(', ')}`),

  body('fontSize')
    .optional()
    .isIn(FONT_SIZE_VALUES)
    .withMessage(`fontSize must be one of: ${FONT_SIZE_VALUES.join(', ')}`),

  body('density')
    .optional()
    .isIn(DENSITY_VALUES)
    .withMessage(`density must be one of: ${DENSITY_VALUES.join(', ')}`),

  body('animations')
    .optional()
    .isIn(ANIMATION_VALUES)
    .withMessage(`animations must be one of: ${ANIMATION_VALUES.join(', ')}`),

  body('scanlines')
    .optional()
    .isBoolean()
    .withMessage('scanlines must be a boolean'),

  body('language')
    .optional()
    .isIn(LANGUAGE_VALUES)
    .withMessage(`language must be one of: ${LANGUAGE_VALUES.join(', ')}`),

  body('privacy.showEmail')
    .optional()
    .isBoolean()
    .withMessage('privacy.showEmail must be a boolean'),

  body('privacy.showHistory')
    .optional()
    .isBoolean()
    .withMessage('privacy.showHistory must be a boolean'),

  body('privacy.showSubscriptions')
    .optional()
    .isBoolean()
    .withMessage('privacy.showSubscriptions must be a boolean'),

  body('notifications.newSubscriber')
    .optional()
    .isBoolean()
    .withMessage('notifications.newSubscriber must be a boolean'),

  body('notifications.newComment')
    .optional()
    .isBoolean()
    .withMessage('notifications.newComment must be a boolean'),

  body('content.autoplay')
    .optional()
    .isBoolean()
    .withMessage('content.autoplay must be a boolean'),

  body('content.defaultVolume')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('content.defaultVolume must be a number between 0 and 1'),
];

export const usernameParamRules = [
  param('username')
    .matches(USERNAME_REGEX)
    .withMessage('Invalid username'),
];
