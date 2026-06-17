import { api } from './client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  globalRole: 'SUPER_ADMIN' | 'USER';
  avatarUrl: string | null;
  avatarName: string | null;
  avatarDescription: string | null;
  avatarRef: string | null;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function registerRequest(payload: RegisterPayload): Promise<{ message: string; user: AuthUser }> {
  const res = await api.post('/auth/register', payload);
  return res.data;
}

export async function loginRequest(payload: LoginPayload): Promise<{ user: AuthUser; accessToken: string }> {
  const res = await api.post('/auth/login', payload);
  return res.data;
}

export async function refreshRequest(): Promise<{ user: AuthUser; accessToken: string }> {
  const res = await api.post('/auth/refresh');
  return res.data;
}

export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout');
}
