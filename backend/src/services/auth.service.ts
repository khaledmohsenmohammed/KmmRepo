import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/jwt.js';
import {
  isRefreshJtiValid,
  revokeRefreshJti,
  storeRefreshJti,
} from '../lib/refreshTokenStore.js';
import type { LoginInput, RegisterInput } from '../routes/auth.schemas.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  status: string;
  globalRole: string;
  avatarUrl: string | null;
  avatarName: string | null;
  avatarDescription: string | null;
  avatarRef: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    globalRole: user.globalRole,
    avatarUrl: user.avatarUrl,
    avatarName: user.avatarName,
    avatarDescription: user.avatarDescription,
    avatarRef: user.avatarRef,
  };
}

async function issueTokens(user: User): Promise<AuthTokens> {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.globalRole,
    status: user.status,
  });
  const { token: refreshToken, jti } = signRefreshToken(user.id);
  await storeRefreshJti(user.id, jti);
  return { accessToken, refreshToken };
}

/** Self-service registration: creates a PENDING account awaiting approval. */
export async function register(input: RegisterInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      status: 'PENDING',
      globalRole: 'USER',
    },
  });

  audit('REGISTER', { type: 'User', id: user.id }, { email: user.email });
  return toPublicUser(user);
}

/** Login: only ACTIVE users may obtain tokens. */
export async function login(
  input: LoginInput,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Use the same error for unknown email and wrong password to avoid enumeration.
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.status === 'PENDING') {
    throw ApiError.forbidden('Your account is awaiting administrator approval');
  }
  if (user.status === 'DISABLED') {
    throw ApiError.forbidden('Your account has been disabled');
  }

  const tokens = await issueTokens(user);
  audit('LOGIN', { type: 'User', id: user.id }, { email: user.email });
  return { user: toPublicUser(user), tokens };
}

/**
 * Refresh with rotation: validate the presented refresh token, ensure its jti
 * is still active, revoke it, and issue a fresh access + refresh pair.
 */
export async function refresh(
  refreshToken: string | undefined,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
  if (!refreshToken) {
    throw ApiError.unauthorized('Missing refresh token');
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const active = await isRefreshJtiValid(payload.sub, payload.jti);
  if (!active) {
    // Token reuse or already rotated/revoked.
    throw ApiError.unauthorized('Refresh token is no longer valid');
  }

  // Rotate: invalidate the old jti before issuing a new pair.
  await revokeRefreshJti(payload.sub, payload.jti);

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account is not active');
  }

  const tokens = await issueTokens(user);
  return { user: toPublicUser(user), tokens };
}

/** Logout: revoke the presented refresh token's jti (best-effort). */
export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeRefreshJti(payload.sub, payload.jti);
  } catch {
    // Already invalid — nothing to revoke.
  }
}
