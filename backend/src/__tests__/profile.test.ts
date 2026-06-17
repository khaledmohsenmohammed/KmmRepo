import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/**
 * In-memory fakes for Prisma and Redis so the profile flow can be tested end-to-end
 * (login → authenticated GET/PATCH /profile) without live infrastructure.
 */
const stores = vi.hoisted(() => {
  const users: Record<string, unknown>[] = [];
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
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const user = stores.users.find((u) => u.id === where.id);
        if (!user) throw new Error('not found');
        Object.assign(user, data, { updatedAt: new Date() });
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

// A tiny but valid base64 PNG data URL.
const SAMPLE_AVATAR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function seedActiveUser() {
  stores.users.push({
    id: `user_${++stores.idCounter.n}`,
    name: 'Test User',
    email: 'user@example.com',
    passwordHash: await hashPassword('Password123'),
    bio: null,
    avatarUrl: null,
    avatarName: null,
    avatarDescription: null,
    avatarRef: null,
    status: 'ACTIVE',
    globalRole: 'USER',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function loginAndGetToken(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'user@example.com', password: 'Password123' });
  return res.body.accessToken as string;
}

beforeEach(() => {
  stores.users.length = 0;
  stores.redisMap.clear();
  stores.idCounter.n = 0;
});

describe('GET /api/v1/profile', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the current user with avatar fields', async () => {
    await seedActiveUser();
    const token = await loginAndGetToken();

    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@example.com');
    expect(res.body.user.globalRole).toBe('USER');
    expect(res.body.user).toHaveProperty('avatarUrl', null);
    expect(res.body.user).toHaveProperty('avatarRef', null);
  });
});

describe('PATCH /api/v1/profile', () => {
  it('updates the name', async () => {
    await seedActiveUser();
    const token = await loginAndGetToken();

    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
    expect(stores.users[0]?.name).toBe('New Name');
  });

  it('stores the avatar and generates an avatarRef', async () => {
    await seedActiveUser();
    const token = await loginAndGetToken();

    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        avatar: SAMPLE_AVATAR,
        avatarName: 'My pic',
        avatarDescription: 'A tiny test image',
      });

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe(SAMPLE_AVATAR);
    expect(res.body.user.avatarName).toBe('My pic');
    expect(res.body.user.avatarDescription).toBe('A tiny test image');
    expect(typeof res.body.user.avatarRef).toBe('string');
    expect(res.body.user.avatarRef).toMatch(/^\d{4}-\d{2}-\d{2}T.*-\d+$/);
  });

  it('rejects a too-short name with 400 and a field error', async () => {
    await seedActiveUser();
    const token = await loginAndGetToken();

    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.fields).toHaveProperty('name');
  });

  it('rejects a non-image avatar with 400', async () => {
    await seedActiveUser();
    const token = await loginAndGetToken();

    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ avatar: 'data:text/plain;base64,aGVsbG8=' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('avatar');
  });

  it('requires authentication', async () => {
    const res = await request(app).patch('/api/v1/profile').send({ name: 'Nope' });
    expect(res.status).toBe(401);
  });
});
