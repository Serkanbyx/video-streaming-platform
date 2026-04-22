import api from '../api/axios.js';
import { unwrap } from './unwrap.js';

import type { AuthPayload, AuthUser } from '@shared/types/user.js';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  RegisterInput,
} from '@shared/schemas/auth.schema.js';
import type { UpdateProfileInput } from '@shared/schemas/user.schema.js';

export const register = async (payload: RegisterInput): Promise<AuthPayload> => {
  const response = await api.post('/api/auth/register', payload);
  return unwrap<AuthPayload>(response);
};

export const login = async (credentials: LoginInput): Promise<AuthPayload> => {
  const response = await api.post('/api/auth/login', credentials);
  return unwrap<AuthPayload>(response);
};

export const getMe = async (): Promise<{ user: AuthUser }> => {
  const response = await api.get('/api/auth/me');
  return unwrap<{ user: AuthUser }>(response);
};

export const updateProfile = async (
  patch: UpdateProfileInput
): Promise<{ user: AuthUser }> => {
  const response = await api.patch('/api/auth/me', patch);
  return unwrap<{ user: AuthUser }>(response);
};

export const changePassword = async (payload: ChangePasswordInput): Promise<void> => {
  await api.post('/api/auth/change-password', payload);
};

export const deleteAccount = async (payload: DeleteAccountInput): Promise<void> => {
  await api.delete('/api/auth/me', { data: payload });
};
