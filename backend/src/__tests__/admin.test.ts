// test-utils must be imported first: it registers vi.mock hoists and exports a
// vi.hoisted() store, which requires this import to precede all others.
import { stores } from './test-utils.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../app.js');
const { signAccessToken } = await import('../lib/jwt.js');

const app = createApp();

let seq = 0;
function addUser(over: Partial<(typeof stores.users)[number]> = {}) {
  const u = {
    id: over.id ?? `user_${++seq}`,
    name: over.name ?? 'User',
    email: over.email ?? `u${seq}@example.com`,
    passwordHash: 'x',
    status: over.status ?? 'PENDING',
    globalRole: over.globalRole ?? 'USER',
    isDeleted: over.isDeleted ?? false,
    deletedAt: over.deletedAt ?? null,
    deletedBy: over.deletedBy ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  stores.users.push(u);
  return u;
}

const adminToken = () =>
  signAccessToken({ sub: 'admin_1', role: 'SUPER_ADMIN', status: 'ACTIVE' });
const userToken = () =>
  signAccessToken({ sub: 'user_x', role: 'USER', status: 'ACTIVE' });
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  stores.users.length = 0;
  stores.redisMap.clear();
  seq = 0;
});

describe('admin authorization', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  it('rejects a non-super-admin token with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set(auth(userToken()));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('listing + status changes', () => {
  it('lists users filtered by status', async () => {
    addUser({ status: 'PENDING', email: 'p@example.com' });
    addUser({ status: 'ACTIVE', email: 'a@example.com' });

    const res = await request(app)
      .get('/api/v1/admin/users?status=PENDING')
      .set(auth(adminToken()));
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].email).toBe('p@example.com');
  });

  it('approves a PENDING user (-> ACTIVE)', async () => {
    const u = addUser({ status: 'PENDING' });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${u.id}`)
      .set(auth(adminToken()))
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('ACTIVE');
  });

  it('deactivates an ACTIVE user and revokes their refresh tokens', async () => {
    const u = addUser({ status: 'ACTIVE' });
    stores.redisMap.set(`refresh:${u.id}:jti1`, '1');
    stores.redisMap.set(`refresh:${u.id}:jti2`, '1');

    const res = await request(app)
      .patch(`/api/v1/admin/users/${u.id}`)
      .set(auth(adminToken()))
      .send({ status: 'DISABLED' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('DISABLED');
    expect(stores.redisMap.has(`refresh:${u.id}:jti1`)).toBe(false);
    expect(stores.redisMap.has(`refresh:${u.id}:jti2`)).toBe(false);
  });

  it('rejects invalid status values with 400', async () => {
    const u = addUser({ status: 'PENDING' });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${u.id}`)
      .set(auth(adminToken()))
      .send({ status: 'PENDING' });
    expect(res.status).toBe(400);
  });
});

describe('super-admin protection', () => {
  it('blocks status change on a SUPER_ADMIN target with 403', async () => {
    const admin = addUser({ globalRole: 'SUPER_ADMIN', status: 'ACTIVE' });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${admin.id}`)
      .set(auth(adminToken()))
      .send({ status: 'DISABLED' });
    expect(res.status).toBe(403);
  });

  it('blocks delete on a SUPER_ADMIN target with 403', async () => {
    const admin = addUser({ globalRole: 'SUPER_ADMIN', status: 'ACTIVE' });
    const res = await request(app)
      .delete(`/api/v1/admin/users/${admin.id}`)
      .set(auth(adminToken()));
    expect(res.status).toBe(403);
  });

  it('blocks restore on a SUPER_ADMIN target with 403', async () => {
    const admin = addUser({ globalRole: 'SUPER_ADMIN', isDeleted: true });
    const res = await request(app)
      .post(`/api/v1/admin/users/${admin.id}/restore`)
      .set(auth(adminToken()));
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('protected');
  });

  it('returns 404 for a missing user', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/nope')
      .set(auth(adminToken()))
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(404);
  });
});

describe('soft delete + restore', () => {
  it('soft-deletes a user (hidden from default list) and restores it', async () => {
    const u = addUser({ status: 'ACTIVE' });

    const del = await request(app)
      .delete(`/api/v1/admin/users/${u.id}`)
      .set(auth(adminToken()));
    expect(del.status).toBe(200);
    expect(del.body.user.isDeleted).toBe(true);

    const def = await request(app)
      .get('/api/v1/admin/users')
      .set(auth(adminToken()));
    expect(
      def.body.users.find((x: { id: string }) => x.id === u.id),
    ).toBeUndefined();

    const deleted = await request(app)
      .get('/api/v1/admin/users?deleted=true')
      .set(auth(adminToken()));
    expect(
      deleted.body.users.find((x: { id: string }) => x.id === u.id),
    ).toBeTruthy();

    const restore = await request(app)
      .post(`/api/v1/admin/users/${u.id}/restore`)
      .set(auth(adminToken()));
    expect(restore.status).toBe(200);
    expect(restore.body.user.isDeleted).toBe(false);
  });
});
