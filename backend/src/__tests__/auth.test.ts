import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/**
 * In-memory fakes for Prisma and Redis so the auth flow can be tested end-to-end
 * (routes → controller → service → lib) without live infrastructure.
 */
const stores = vi.hoisted(() => {
  type FakeUser = {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    status: string;
    globalRole: string;
    createdAt: Date;
    updatedAt: Date;
  };
  const users: FakeUser[] = [];
  const redisMap = new Map<string, string>();
  return { users, redisMap, idCounter: { n: 0 } };
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        stores.users.find(
          (u) => (where.email && u.email === where.email) || (where.id && u.id === where.id),
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const user = {
          id: `user_${++stores.idCounter.n}`,
          bio: null,
          avatarUrl: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        } as unknown as (typeof stores.users)[number];
        stores.users.push(user);
        return user;
      },
    },
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    set: async (key: string, value: string) => {
      stores.redisMap.set(key, value);
      return 'OK';
    },
    exists: async (key: string) => (stores.redisMap.has(key) ? 1 : 0),
    del: async (key: string) => (stores.redisMap.delete(key) ? 1 : 0),
    on: () => undefined,
  },
}));

const { createApp } = await import('../app.js');
const { hashPassword } = await import('../lib/password.js');

const app = createApp();

async function seedUser(overrides: Partial<{ email: string; status: string; password: string }> = {}) {
  const password = overrides.password ?? 'Password123';
  stores.users.push({
    id: `user_${++stores.idCounter.n}`,
    name: 'Test User',
    email: overrides.email ?? 'user@example.com',
    passwordHash: await hashPassword(password),
    status: overrides.status ?? 'ACTIVE',
    globalRole: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function refreshCookieFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith('refreshToken='));
  if (!cookie) throw new Error('No refresh cookie set');
  return cookie.split(';')[0]!;
}

beforeEach(() => {
  stores.users.length = 0;
  stores.redisMap.clear();
  stores.idCounter.n = 0;
});

describe('POST /api/v1/auth/register', () => {
  it('creates a PENDING user and returns no token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('PENDING');
    expect(res.body).not.toHaveProperty('accessToken');
    expect(stores.users[0]?.status).toBe('PENDING');
  });

  it('rejects a duplicate email with 409', async () => {
    await seedUser({ email: 'dupe@example.com' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dupe', email: 'dupe@example.com', password: 'Password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid input with 400 and field errors', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.fields).toHaveProperty('email');
    expect(res.body.error.fields).toHaveProperty('password');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('blocks a PENDING user with 403', async () => {
    await seedUser({ email: 'pending@example.com', status: 'PENDING' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pending@example.com', password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns an access token + refresh cookie for an ACTIVE user', async () => {
    await seedUser({ email: 'active@example.com', status: 'ACTIVE' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'active@example.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(refreshCookieFrom(res)).toContain('refreshToken=');
  });

  it('rejects a wrong password with 401', async () => {
    await seedUser({ email: 'active@example.com', status: 'ACTIVE' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'active@example.com', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('refresh rotation + logout', () => {
  async function loginAndGetCookie() {
    await seedUser({ email: 'active@example.com', status: 'ACTIVE' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'active@example.com', password: 'Password123' });
    return refreshCookieFrom(res);
  }

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const cookie = await loginAndGetCookie();

    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();

    // Reusing the original (now-rotated) cookie must fail.
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reuse.status).toBe(401);
  });

  it('revokes the refresh token on logout', async () => {
    const cookie = await loginAndGetCookie();

    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);

    const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});
