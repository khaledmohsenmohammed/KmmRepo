import { api } from './client';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  globalRole: 'SUPER_ADMIN' | 'USER';
  isDeleted: boolean;
  createdAt: string;
}

export interface ListUsersParams {
  status?: UserStatus;
  deleted?: boolean;
}

export async function listUsers(params: ListUsersParams = {}): Promise<AdminUser[]> {
  const res = await api.get('/admin/users', {
    params: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.deleted ? { deleted: 'true' } : {}),
    },
  });
  return res.data.users;
}

export async function updateUserStatus(id: string, status: 'ACTIVE' | 'DISABLED'): Promise<AdminUser> {
  const res = await api.patch(`/admin/users/${id}`, { status });
  return res.data.user;
}

export async function deleteUser(id: string): Promise<AdminUser> {
  const res = await api.delete(`/admin/users/${id}`);
  return res.data.user;
}

export async function restoreUser(id: string): Promise<AdminUser> {
  const res = await api.post(`/admin/users/${id}/restore`);
  return res.data.user;
}
