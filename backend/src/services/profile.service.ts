import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { toPublicUser, type PublicUser } from './auth.service.js';
import type { UpdateProfileInput } from '../routes/profile.schemas.js';

/** Generate a unique avatar reference: "<ISO date-time>-<random>". */
function newAvatarRef(): string {
  const random = Math.floor(Math.random() * 1_000_000);
  return `${new Date().toISOString()}-${random}`;
}

/** Get the current user's full profile. */
export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted) {
    throw ApiError.notFound('User not found');
  }
  return toPublicUser(user);
}

/**
 * Update the current user's own profile. Only name + avatar fields are editable;
 * role/status/email are managed elsewhere. A new image gets a fresh avatarRef.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || existing.isDeleted) {
    throw ApiError.notFound('User not found');
  }

  const data: {
    name?: string;
    avatarName?: string;
    avatarDescription?: string;
    avatarUrl?: string;
    avatarRef?: string;
  } = {};

  if (input.name !== undefined) data.name = input.name;
  if (input.avatarName !== undefined) data.avatarName = input.avatarName;
  if (input.avatarDescription !== undefined) data.avatarDescription = input.avatarDescription;
  if (input.avatar !== undefined) {
    data.avatarUrl = input.avatar;
    data.avatarRef = newAvatarRef();
  }

  const user = await prisma.user.update({ where: { id: userId }, data });

  audit('UPDATE_PROFILE', { type: 'User', id: user.id }, { fields: Object.keys(data) });
  return toPublicUser(user);
}
