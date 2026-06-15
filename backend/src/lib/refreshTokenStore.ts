import { redis } from './redis.js';

/**
 * Refresh-token rotation store.
 * Each issued refresh token's `jti` is recorded in Redis under
 * `refresh:<userId>:<jti>`. A token is only valid for refresh if its jti is
 * still present. Rotation deletes the old jti and stores the new one; logout
 * (and reuse detection) deletes it.
 */

const key = (userId: string, jti: string) => `refresh:${userId}:${jti}`;

// 7 days in seconds — keep in sync with REFRESH_TOKEN_TTL.
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function storeRefreshJti(userId: string, jti: string): Promise<void> {
  await redis.set(key(userId, jti), '1', 'EX', REFRESH_TTL_SECONDS);
}

export async function isRefreshJtiValid(userId: string, jti: string): Promise<boolean> {
  const exists = await redis.exists(key(userId, jti));
  return exists === 1;
}

export async function revokeRefreshJti(userId: string, jti: string): Promise<void> {
  await redis.del(key(userId, jti));
}
