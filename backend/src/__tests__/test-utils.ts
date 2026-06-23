import { vi } from 'vitest';

type FakeUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  status: string;
  globalRole: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Shared, mutable in-memory state for the mocks below. A plain module object —
// the vi.mock factories reference it lazily (inside vi.fn callbacks that run at
// call time, after this module has finished initializing), so it does not need
// to be hoisted.
export const stores: { users: FakeUser[]; redisMap: Map<string, string> } = {
  users: [],
  redisMap: new Map<string, string>(),
};

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { isDeleted?: boolean; status?: string };
        }) =>
          stores.users
            .filter(
              (u) =>
                where.isDeleted === undefined ||
                u.isDeleted === where.isDeleted,
            )
            .filter(
              (u) => where.status === undefined || u.status === where.status,
            ),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { email?: string; id?: string } }) =>
          stores.users.find(
            (u) =>
              (where.email && u.email === where.email) ||
              (where.id && u.id === where.id),
          ) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const id = `user_${stores.users.length + 1}`;
        const user = {
          id,
          bio: null,
          avatarUrl: null,
          avatarName: null,
          avatarDescription: null,
          avatarRef: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        } as unknown as FakeUser;
        stores.users.push(user);
        return user;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const user = stores.users.find((u) => u.id === where.id);
          if (!user) throw new Error('User not found for update');
          Object.assign(user, data, { updatedAt: new Date() });
          return user;
        },
      ),
    },
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    set: vi.fn(async (key: string, value: string) => {
      stores.redisMap.set(key, value);
      return 'OK';
    }),
    exists: vi.fn(async (key: string) => (stores.redisMap.has(key) ? 1 : 0)),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      keys.forEach((k) => {
        if (stores.redisMap.delete(k)) count++;
      });
      return count;
    }),
    scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
      const prefix = pattern.replace(/\*$/, '');
      const keys = [...stores.redisMap.keys()].filter((k) =>
        k.startsWith(prefix),
      );
      return ['0', keys];
    }),
    on: vi.fn(() => undefined),
  },
}));
