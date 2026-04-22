import { body, param } from 'express-validator';

const BODY_MIN = 1;
const BODY_MAX = 1000;

const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{6,32}$/;

export const createRules = [
  body('videoId')
    .exists({ values: 'falsy' })
    .withMessage('videoId is required')
    .bail()
    .isString()
    .withMessage('videoId must be a string')
    .bail()
    .trim()
    .matches(VIDEO_ID_REGEX)
    .withMessage('Invalid videoId'),

  body('body')
    .exists({ values: 'falsy' })
    .withMessage('Comment body is required')
    .bail()
    .isString()
    .withMessage('Comment body must be a string')
    .bail()
    .trim()
    .isLength({ min: BODY_MIN, max: BODY_MAX })
    .withMessage(`Comment body must be between ${BODY_MIN} and ${BODY_MAX} characters`)
    .escape(),

  body('parent')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('parent must be a valid id'),
];

export const editRules = [
  body('body')
    .exists({ values: 'falsy' })
    .withMessage('Comment body is required')
    .bail()
    .isString()
    .withMessage('Comment body must be a string')
    .bail()
    .trim()
    .isLength({ min: BODY_MIN, max: BODY_MAX })
    .withMessage(`Comment body must be between ${BODY_MIN} and ${BODY_MAX} characters`)
    .escape(),
];

export const commentIdParamRules = [
  param('commentId')
    .isMongoId()
    .withMessage('Invalid comment id'),
];
