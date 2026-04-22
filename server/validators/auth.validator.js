import { body } from 'express-validator';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
// At least one letter and one digit; full character class is intentionally
// permissive so users can include punctuation/symbols in their passphrase.
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const registerRules = [
  body('username')
    .exists({ values: 'falsy' })
    .withMessage('Username is required')
    .bail()
    .isString()
    .withMessage('Username must be a string')
    .bail()
    .trim()
    .isLength({ min: 3, max: 24 })
    .withMessage('Username must be between 3 and 24 characters')
    .matches(USERNAME_REGEX)
    .withMessage('Username may contain only letters, numbers and underscore')
    .escape(),

  body('email')
    .exists({ values: 'falsy' })
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('password')
    .exists({ values: 'falsy' })
    .withMessage('Password is required')
    .bail()
    .isString()
    .withMessage('Password must be a string')
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(PASSWORD_COMPLEXITY_REGEX)
    .withMessage('Password must contain at least one letter and one digit'),
];

export const loginRules = [
  body('email')
    .exists({ values: 'falsy' })
    .withMessage('Email is required')
    .bail()
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),

  body('password')
    .exists({ values: 'falsy' })
    .withMessage('Password is required')
    .bail()
    .isString()
    .withMessage('Password must be a string')
    .notEmpty()
    .withMessage('Password is required'),
];

export const changePasswordRules = [
  body('currentPassword')
    .exists({ values: 'falsy' })
    .withMessage('Current password is required')
    .bail()
    .isString()
    .withMessage('Current password must be a string')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .exists({ values: 'falsy' })
    .withMessage('New password is required')
    .bail()
    .isString()
    .withMessage('New password must be a string')
    .bail()
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(PASSWORD_COMPLEXITY_REGEX)
    .withMessage('New password must contain at least one letter and one digit'),
];

export const deleteAccountRules = [
  body('password')
    .exists({ values: 'falsy' })
    .withMessage('Password is required')
    .bail()
    .isString()
    .withMessage('Password must be a string')
    .notEmpty()
    .withMessage('Password is required'),
];
