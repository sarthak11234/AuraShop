import { auth } from '@/auth';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { hasAdminPermission, isAdminRole, type AdminRole } from '@/lib/admin-authorization';
import { rateLimitActorAction } from '@/lib/rate-limit';

export type AdminActor = {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
};

type SessionUser = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: unknown;
};

function toAdminActor(user: SessionUser | undefined): AdminActor | null {
  if (!user?.id || !isAdminRole(user.role) || !user.email) return null;

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    role: user.role,
  };
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await auth();
  return toAdminActor(session?.user);
}

export async function requireAdminPage() {
  const actor = await getAdminActor();
  if (!actor) redirect('/admin/login');
  return actor;
}

export async function requireAdminApi(
  requiredRole: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN',
): Promise<
  | { actor: AdminActor; response: null }
  | { actor: null; response: NextResponse }
> {
  const session = await auth();
  const actor = toAdminActor(session?.user);

  if (!actor) {
    // Distinguish "no session" from "signed in without admin rights".
    const authenticated = Boolean(session?.user?.id);
    return {
      actor: null,
      response: NextResponse.json(
        { error: authenticated ? 'Forbidden' : 'Unauthorized' },
        { status: authenticated ? 403 : 401 },
      ),
    };
  }

  if (!hasAdminPermission(actor.role, requiredRole)) {
    return {
      actor: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { actor, response: null };
}

export async function rateLimitAdminAction(actorId: string, action: string, limit = 30) {
  return rateLimitActorAction(actorId, action, limit);
}

export async function writeAdminAudit(
  tx: Prisma.TransactionClient,
  entry: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    reason?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
) {
  await tx.adminAuditLog.create({
    data: {
      ...entry,
      reason: entry.reason || undefined,
      before: entry.before,
      after: entry.after,
    },
  });
}
