import { body, param } from 'express-validator';

const ROLE_VALUES = ['viewer', 'creator', 'admin'];

export const setRoleRules = [
  body('role')
    .exists({ values: 'falsy' })
    .withMessage('role is required')
    .bail()
    .isIn(ROLE_VALUES)
    .withMessage(`role must be one of: ${ROLE_VALUES.join(', ')}`),
];

export const toggleBanRules = [
  body('isBanned')
    .exists({ values: 'null' })
    .withMessage('isBanned is required')
    .bail()
    .isBoolean()
    .withMessage('isBanned must be a boolean')
    .toBoolean(),
];

export const flagVideoRules = [
  body('isFlagged')
    .exists({ values: 'null' })
    .withMessage('isFlagged is required')
    .bail()
    .isBoolean()
    .withMessage('isFlagged must be a boolean')
    .toBoolean(),
];

export const cleanupRules = [
  body('failedOlderThanDays')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 365 })
    .withMessage('failedOlderThanDays must be an integer between 1 and 365')
    .toInt(),

  body('dryRun')
    .optional({ values: 'undefined' })
    .isBoolean()
    .withMessage('dryRun must be a boolean')
    .toBoolean(),
];

export const userIdParamRules = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user id'),
];

export const commentIdParamRules = [
  param('commentId')
    .isMongoId()
    .withMessage('Invalid comment id'),
];
