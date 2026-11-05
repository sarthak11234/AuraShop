import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction, writeAdminAudit } from '@/lib/admin';
import { db } from '@/lib/db';
import {
  canTransitionReturnStatus,
  returnStatusLabel,
  type ReturnStatus,
} from '@/lib/return-lifecycle';

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? body : {};
  }
  const formData = await request.formData();
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    result[key] = value;
  }
  return result;
}

async function transitionReturn(
  actorId: string,
  returnId: string,
  nextStatus: ReturnStatus,
  reason?: string | null,
) {
  return db.$transaction(async (tx) => {
    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnId },
    });
    if (!returnRequest) return { kind: 'not-found' as const };

    if (!canTransitionReturnStatus(returnRequest.status, nextStatus)) {
      return {
        kind: 'not-eligible' as const,
        reason: `Cannot transition from "${returnStatusLabel(
          returnRequest.status,
        )}" to "${returnStatusLabel(nextStatus)}".`,
      };
    }

    const claimed = await tx.returnRequest.updateMany({
      where: { id: returnId, status: returnRequest.status },
      data: {
        status: nextStatus,
        ...(nextStatus === 'REJECTED' ? { resolvedAt: new Date() } : {}),
        ...(reason ? { adminNotes: reason } : {}),
      },
    });
    if (claimed.count !== 1) return { kind: 'conflict' as const };

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId: returnId,
        status: nextStatus,
        title: returnStatusLabel(nextStatus),
        source: 'ADMIN',
        actorId,
        description: reason ?? `Return moved to ${returnStatusLabel(nextStatus)}.`,
      },
    });

    await writeAdminAudit(tx, {
      actorId,
      action: `return.${nextStatus.toLowerCase()}`,
      entityType: 'return',
      entityId: returnId,
      reason: reason ?? undefined,
    });

    return { kind: 'ok' as const };
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-reject', 30);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  const body = await readBody(_request);
  const reason = readString(body.reason);
  if (!reason) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const result = await transitionReturn(
    actor.id,
    returnId,
    'REJECTED' as ReturnStatus,
    reason,
  );

  if (result.kind === 'not-found') {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }
  if (result.kind === 'not-eligible') {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  if (result.kind === 'conflict') {
    return NextResponse.json({ error: 'Concurrent modification' }, { status: 409 });
  }

  return NextResponse.json({ status: 'REJECTED' });
}
