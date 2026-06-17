import { api } from './client';
import type { AuthUser } from './auth';

export interface UpdateProfilePayload {
  name?: string;
  avatarName?: string;
  avatarDescription?: string;
  /** base64 data URL: "data:image/...;base64,..." */
  avatar?: string;
}

export async function getProfile(): Promise<AuthUser> {
  const res = await api.get('/profile');
  return res.data.user;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  const res = await api.patch('/profile', payload);
  return res.data.user;
}
