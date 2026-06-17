import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/** In-memory Prisma + Redis fakes (mirrors admin.test.ts) for the projects flow. */
const stores = vi.hoisted(() => {
  const users: Record<string, any>[] = [];
  const projects: Record<string, any>[] = [];
  const memberships: Record<string, any>[] = [];
  const redisMap = new Map<string, string>();
  return { users, projects, memberships, redisMap, seq: { n: 0 } };
});

const countMembers = (projectId: string) =>
  stores.memberships.filter((m) => m.projectId === projectId).length;
const withCount = (p: Record<string, any>) => ({
  ...p,
  _count: { memberships: countMembers(p.id) },
});

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { id?: string } }) =>
        stores.users.find((u) => u.id === where.id) ?? null,
    },
    project: {
      findMany: async ({ where }: { where: { isDeleted?: boolean } }) =>
        stores.projects
          .filter((p) => where.isDeleted === undefined || p.isDeleted === where.isDeleted)
          .map(withCount),
      findUnique: async ({ where }: { where: { id: string } }) =>
        stores.projects.find((p) => p.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, any> }) => {
        const project = {
          id: `proj_${++stores.seq.n}`,
          description: null,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        stores.projects.push(project);
        return project;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const project = stores.projects.find((p) => p.id === where.id);
        if (!project) throw new Error('not found');
        Object.assign(project, data);
        return withCount(project);
      },
    },
    projectMembership: {
      findMany: async ({ where }: { where: { projectId: string } }) =>
        stores.memberships
          .filter((m) => m.projectId === where.projectId)
          .map((m) => ({ ...m, user: stores.users.find((u) => u.id === m.userId) })),
      findUnique: async ({
        where,
      }: {
        where: { userId_projectId: { userId: string; projectId: string } };
      }) =>
        stores.memberships.find(
          (m) =>
            m.userId === where.userId_projectId.userId &&
            m.projectId === where.userId_projectId.projectId,
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId_projectId: { userId: string; projectId: string } };
        create: Record<string, any>;
        update: Record<string, any>;
      }) => {
        let m = stores.memberships.find(
          (x) =>
            x.userId === where.userId_projectId.userId &&
            x.projectId === where.userId_projectId.projectId,
        );
        if (m) {
          Object.assign(m, update);
        } else {
          m = { id: `mem_${++stores.seq.n}`, grantedAt: new Date(), ...create };
          stores.memberships.push(m);
        }
        return { ...m, user: stores.users.find((u) => u.id === m.userId) };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = stores.memberships.findIndex((m) => m.id === where.id);
        if (i >= 0) stores.memberships.splice(i, 1);
        return {};
      },
    },
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    set: async () => 'OK',
    exists: async () => 0,
    del: async () => 0,
    scan: async () => ['0', []],
    on: () => undefined,
  },
}));

const { createApp } = await import('../app.js');
const { signAccessToken } = await import('../lib/jwt.js');

const app = createApp();

const adminToken = () => signAccessToken({ sub: 'admin_1', role: 'SUPER_ADMIN', status: 'ACTIVE' });
const userToken = () => signAccessToken({ sub: 'user_x', role: 'USER', status: 'ACTIVE' });
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function addUser(over: Record<string, any> = {}) {
  const u = {
    id: over.id ?? `user_${++stores.seq.n}`,
    name: over.name ?? 'Member User',
    email: over.email ?? `m${stores.seq.n}@example.com`,
    status: over.status ?? 'ACTIVE',
    globalRole: over.globalRole ?? 'USER',
    isDeleted: over.isDeleted ?? false,
  };
  stores.users.push(u);
  return u;
}

async function createProject(name = 'Proj') {
  const res = await request(app)
    .post('/api/v1/admin/projects')
    .set(auth(adminToken()))
    .send({ name });
  return res.body.project;
}

beforeEach(() => {
  stores.users.length = 0;
  stores.projects.length = 0;
  stores.memberships.length = 0;
  stores.redisMap.clear();
  stores.seq.n = 0;
});

describe('auth gating', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/admin/projects');
    expect(res.status).toBe(401);
  });

  it('rejects non-super-admin with 403', async () => {
    const res = await request(app).get('/api/v1/admin/projects').set(auth(userToken()));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('project CRUD', () => {
  it('creates a project (201) with 0 members', async () => {
    const res = await request(app)
      .post('/api/v1/admin/projects')
      .set(auth(adminToken()))
      .send({ name: 'Mobile App', description: 'desc' });
    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Mobile App');
    expect(res.body.project.memberCount).toBe(0);
  });

  it('rejects an invalid name with 400 + field error', async () => {
    const res = await request(app)
      .post('/api/v1/admin/projects')
      .set(auth(adminToken()))
      .send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('name');
  });

  it('lists active projects and excludes soft-deleted ones', async () => {
    const p = await createProject('Keeper');
    await createProject('ToDelete');
    await request(app).delete(`/api/v1/admin/projects/${p.id}`).set(auth(adminToken()));

    const active = await request(app).get('/api/v1/admin/projects').set(auth(adminToken()));
    expect(active.body.projects.map((x: any) => x.name)).toEqual(['ToDelete']);

    const deleted = await request(app)
      .get('/api/v1/admin/projects?deleted=true')
      .set(auth(adminToken()));
    expect(deleted.body.projects.map((x: any) => x.name)).toEqual(['Keeper']);
  });

  it('renames a project via PATCH', async () => {
    const p = await createProject('Old');
    const res = await request(app)
      .patch(`/api/v1/admin/projects/${p.id}`)
      .set(auth(adminToken()))
      .send({ name: 'New', description: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('New');
    expect(res.body.project.description).toBe('updated');
  });

  it('soft-deletes and restores a project', async () => {
    const p = await createProject('Temp');
    const del = await request(app)
      .delete(`/api/v1/admin/projects/${p.id}`)
      .set(auth(adminToken()));
    expect(del.status).toBe(200);
    expect(del.body.project.isDeleted).toBe(true);

    const restore = await request(app)
      .post(`/api/v1/admin/projects/${p.id}/restore`)
      .set(auth(adminToken()));
    expect(restore.status).toBe(200);
    expect(restore.body.project.isDeleted).toBe(false);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/projects/nope')
      .set(auth(adminToken()))
      .send({ name: 'Valid' });
    expect(res.status).toBe(404);
  });
});

describe('membership management', () => {
  it('assigns a user with a role, then re-assign updates the role', async () => {
    const p = await createProject('WithMembers');
    const u = addUser({ name: 'Alice', email: 'alice@example.com' });

    const add = await request(app)
      .post(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()))
      .send({ userId: u.id, role: 'MANUAL_TESTER' });
    expect(add.status).toBe(201);
    expect(add.body.member.role).toBe('MANUAL_TESTER');
    expect(add.body.member.name).toBe('Alice');

    // Re-assign -> updates role, not a duplicate
    const reassign = await request(app)
      .post(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()))
      .send({ userId: u.id, role: 'TEST_LEAD' });
    expect(reassign.status).toBe(201);
    expect(reassign.body.member.role).toBe('TEST_LEAD');

    const members = await request(app)
      .get(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()));
    expect(members.body.members).toHaveLength(1);

    // member count surfaces in the list
    const list = await request(app).get('/api/v1/admin/projects').set(auth(adminToken()));
    expect(list.body.projects[0].memberCount).toBe(1);
  });

  it('rejects an invalid role with 400', async () => {
    const p = await createProject('Proj');
    const u = addUser();
    const res = await request(app)
      .post(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()))
      .send({ userId: u.id, role: 'OWNER' });
    expect(res.status).toBe(400);
  });

  it('rejects assigning a non-active user with 400', async () => {
    const p = await createProject('Proj');
    const u = addUser({ status: 'PENDING' });
    const res = await request(app)
      .post(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()))
      .send({ userId: u.id, role: 'PENTESTER' });
    expect(res.status).toBe(400);
  });

  it('removes a member', async () => {
    const p = await createProject('Proj');
    const u = addUser();
    await request(app)
      .post(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()))
      .send({ userId: u.id, role: 'PROJECT_LEAD' });

    const del = await request(app)
      .delete(`/api/v1/admin/projects/${p.id}/members/${u.id}`)
      .set(auth(adminToken()));
    expect(del.status).toBe(200);

    const members = await request(app)
      .get(`/api/v1/admin/projects/${p.id}/members`)
      .set(auth(adminToken()));
    expect(members.body.members).toHaveLength(0);
  });
});
