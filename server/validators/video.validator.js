import { body, param, query } from 'express-validator';

const VISIBILITY_VALUES = ['public', 'unlisted'];
const SORT_VALUES = ['new', 'top', 'liked'];

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const TAG_MIN = 1;
const TAG_MAX = 24;
const TAGS_MAX_COUNT = 8;

const Q_MAX = 100;
const TAG_QUERY_MAX = 24;
const PAGE_SIZE_MAX = 48;

const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{6,32}$/;

/**
 * `tags` arrives in three shapes depending on the transport:
 *   - JSON body (PATCH)   → real array
 *   - multipart, multi    → real array (multer collects repeats)
 *   - multipart, single   → string ("foo,bar" or '["foo","bar"]')
 *
 * Normalize all three to an array BEFORE the `isArray` assertion runs so the
 * downstream controller and Mongoose schema receive a consistent shape.
 */
const normalizeTagsSanitizer = (value) => {
  if (value === undefined || value === null || value === '') return value;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to comma-split
    }
  }
  return trimmed
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
};

const tagsValidator = body('tags')
  .optional({ values: 'falsy' })
  .customSanitizer(normalizeTagsSanitizer)
  .isArray({ max: TAGS_MAX_COUNT })
  .withMessage(`Tags must be an array of at most ${TAGS_MAX_COUNT} entries`);

const tagItemsValidator = body('tags.*')
  .optional()
  .isString()
  .withMessage('Each tag must be a string')
  .bail()
  .trim()
  .toLowerCase()
  .isLength({ min: TAG_MIN, max: TAG_MAX })
  .withMessage(`Each tag must be between ${TAG_MIN} and ${TAG_MAX} characters`)
  .matches(/^[a-z0-9_-]+$/)
  .withMessage('Tags may contain only letters, numbers, dashes and underscores');

export const createRules = [
  body('title')
    .exists({ values: 'falsy' })
    .withMessage('Title is required')
    .bail()
    .isString()
    .withMessage('Title must be a string')
    .bail()
    .trim()
    .isLength({ min: TITLE_MIN, max: TITLE_MAX })
    .withMessage(`Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters`)
    .escape(),

  body('description')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Description must be a string')
    .bail()
    .trim()
    .isLength({ max: DESCRIPTION_MAX })
    .withMessage(`Description must be at most ${DESCRIPTION_MAX} characters`)
    .escape(),

  tagsValidator,
  tagItemsValidator,

  body('visibility')
    .optional({ values: 'falsy' })
    .isIn(VISIBILITY_VALUES)
    .withMessage(`Visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`),
];

export const updateRules = [
  body('title')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Title must be a string')
    .bail()
    .trim()
    .isLength({ min: TITLE_MIN, max: TITLE_MAX })
    .withMessage(`Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters`)
    .escape(),

  body('description')
    .optional({ values: 'undefined' })
    .isString()
    .withMessage('Description must be a string')
    .bail()
    .trim()
    .isLength({ max: DESCRIPTION_MAX })
    .withMessage(`Description must be at most ${DESCRIPTION_MAX} characters`)
    .escape(),

  tagsValidator,
  tagItemsValidator,

  body('visibility')
    .optional({ values: 'falsy' })
    .isIn(VISIBILITY_VALUES)
    .withMessage(`Visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`),
];

/**
 * NOTE on Express 5: validators may NOT mutate `req.query` (it is a frozen
 * getter). We therefore avoid sanitizers like `.toInt()` / `.toLowerCase()` on
 * query params and let controllers re-parse instead. The validators below are
 * read-only assertions that block obviously malformed input early.
 */
export const listQueryRules = [
  query('q')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('q must be a string')
    .bail()
    .isLength({ max: Q_MAX })
    .withMessage(`q must be at most ${Q_MAX} characters`),

  query('tag')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('tag must be a string')
    .bail()
    .isLength({ max: TAG_QUERY_MAX })
    .withMessage(`tag must be at most ${TAG_QUERY_MAX} characters`),

  query('sort')
    .optional({ values: 'falsy' })
    .isIn(SORT_VALUES)
    .withMessage(`sort must be one of: ${SORT_VALUES.join(', ')}`),

  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer'),

  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: PAGE_SIZE_MAX })
    .withMessage(`limit must be between 1 and ${PAGE_SIZE_MAX}`),
];

export const viewRules = [
  body('fingerprint')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('fingerprint must be a valid UUID'),
];

export const videoIdParamRules = [
  param('videoId')
    .matches(VIDEO_ID_REGEX)
    .withMessage('Invalid videoId'),
];
