import { z } from 'zod';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be between 3 and 24 characters')
  .max(24, 'Username must be between 3 and 24 characters')
  .regex(USERNAME_REGEX, 'Username may contain only letters, numbers and underscore');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be between 8 and 128 characters')
  .max(128, 'Password must be between 8 and 128 characters')
  .regex(PASSWORD_COMPLEXITY_REGEX, 'Password must contain at least one letter and one digit');

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
