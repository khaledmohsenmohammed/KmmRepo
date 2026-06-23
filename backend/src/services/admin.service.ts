import type { User, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { revokeAllRefreshForUser } from '../lib/refreshTokenStore.js';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  globalRole: string;
  isDeleted: boolean;
  createdAt: Date;
}

function toAdminUser(user: User): AdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    globalRole: user.globalRole,
    isDeleted: user.isDeleted,
    createdAt: user.createdAt,
  };
}

export interface ListUsersParams {
  status?: UserStatus;
  deleted?: boolean;
}

export async function listUsers(params: ListUsersParams): Promise<AdminUser[]> {
  const users = await prisma.user.findMany({
    where: {
      isDeleted: params.deleted ?? false,
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return users.map(toAdminUser);
}

/**
 * Loads a mutation target and enforces shared rules:
 * - 404 if the user does not exist.
 * - 403 if the target is a SUPER_ADMIN (protects the system-seeded admin and
 *   prevents an admin from locking out / deleting any admin, including self).
 */
async function loadActionableTarget(id: string): Promise<User> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    throw ApiError.notFound('User not found');
  }
  if (target.globalRole === 'SUPER_ADMIN') {
    throw ApiError.forbidden(
      'Super-admin accounts are protected and cannot be modified',
    );
  }
  return target;
}

/** Approve / Reject / Activate / Deactivate — sets status to ACTIVE or DISABLED. */
export async function setUserStatus(
  actingUserId: string,
  id: string,
  status: 'ACTIVE' | 'DISABLED',
): Promise<AdminUser> {
  await loadActionableTarget(id);
  const updated = await prisma.user.update({ where: { id }, data: { status } });

  if (status === 'DISABLED') {
    await revokeAllRefreshForUser(id);
  }

  audit(
    status === 'ACTIVE' ? 'APPROVE' : 'DISABLE',
    { type: 'User', id },
    { by: actingUserId },
  );
  return toAdminUser(updated);
}

export async function softDeleteUser(
  actingUserId: string,
  id: string,
): Promise<AdminUser> {
  await loadActionableTarget(id);
  const updated = await prisma.user.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date(), deletedBy: actingUserId },
  });
  await revokeAllRefreshForUser(id);

  audit('DELETE', { type: 'User', id }, { by: actingUserId });
  return toAdminUser(updated);
}

export async function restoreUser(
  actingUserId: string,
  id: string,
): Promise<AdminUser> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    throw ApiError.notFound('User not found');
  }
  // A super-admin cannot be restored via the API. This is a safeguard.
  // While they can't be soft-deleted in the first place, this prevents issues
  // if the database is ever modified manually.
  if (target.globalRole === 'SUPER_ADMIN') {
    throw ApiError.forbidden(
      'Super-admin accounts are protected and cannot be restored',
    );
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { isDeleted: false, deletedAt: null, deletedBy: null },
  });

  audit('RESTORE', { type: 'User', id }, { by: actingUserId });
  return toAdminUser(updated);
}
