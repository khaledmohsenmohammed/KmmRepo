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

/**
 * Revokes every active refresh token for a user (e.g. when an admin disables or
 * deletes them) so they can no longer obtain new access tokens. Their current
 * access token still works until it expires (≤ ACCESS_TOKEN_TTL).
 */
export async function revokeAllRefreshForUser(userId: string): Promise<void> {
  const pattern = `refresh:${userId}:*`;
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
