import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

try {
  process.loadEnvFile('.env.local');
} catch {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Use environment variables supplied by the deployment operator.
  }
}

const email = process.env.PROMOTE_ADMIN_EMAIL?.trim();
const requestedRole = process.env.PROMOTE_ADMIN_ROLE ?? 'ADMIN';

if (!email || (requestedRole !== 'ADMIN' && requestedRole !== 'SUPER_ADMIN')) {
  throw new Error('Set PROMOTE_ADMIN_EMAIL and optionally PROMOTE_ADMIN_ROLE=ADMIN|SUPER_ADMIN.');
}

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const db = new PrismaClient({ adapter });

async function main() {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { email, emailVerified: { not: null } },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new Error('No verified account matched PROMOTE_ADMIN_EMAIL; sign in and verify the account first.');
    }

    await tx.user.update({ where: { id: user.id }, data: { role: requestedRole } });
    await tx.adminAuditLog.create({
      data: {
        actorId: user.id,
        action: 'admin.role_provisioned',
        entityType: 'user',
        entityId: user.id,
        reason: 'Provisioned by a trusted operator command',
        before: { role: user.role },
        after: { role: requestedRole },
      },
    });
  });
  console.log(`Promoted one verified account to ${requestedRole}.`);
}

main()
  .catch((error) => {
    console.error('Administrator provisioning failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
