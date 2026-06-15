import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL ?? 'admin@kmmrepo.local';
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? 'ChangeMe!123';
  const name = process.env.SEED_SUPERADMIN_NAME ?? 'Super Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super-admin already exists: ${email} (no changes)`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      status: 'ACTIVE',
      globalRole: 'SUPER_ADMIN',
    },
  });

  console.log('───────────────────────────────────────────');
  console.log(' Super-admin created.');
  console.log(`   email:    ${email}`);
  console.log(`   password: ${password}`);
  console.log(' ⚠  Change this password on first login.');
  console.log('───────────────────────────────────────────');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
