import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { db } from '@/lib/db';
import { parseTrackingMetadata, upsertOrderTrackingEvent } from '@/lib/order-tracking';

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

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-tracking', 30);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  const body = await readBody(_request);
  const metadata = parseTrackingMetadata(body);
  if (!metadata.ok) {
    return NextResponse.json({ error: metadata.error }, { status: 400 });
  }

  const returnRequest = await db.returnRequest.findUnique({
    where: { id: returnId },
    select: { id: true, orderId: true, status: true },
  });
  if (!returnRequest) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.returnShipment.upsert({
      where: { returnRequestId: returnId },
      update: {
        carrier: metadata.data.carrier ?? null,
        trackingNumber: metadata.data.trackingNumber ?? null,
        trackingUrl: metadata.data.trackingUrl ?? null,
        ...(metadata.data.shippedAt ? { shippedAt: metadata.data.shippedAt } : {}),
        ...(metadata.data.trackingNumber ? { receivedAt: null } : {}),
      },
      create: {
        returnRequestId: returnId,
        carrier: metadata.data.carrier ?? null,
        trackingNumber: metadata.data.trackingNumber ?? null,
        trackingUrl: metadata.data.trackingUrl ?? null,
        shippedAt: metadata.data.shippedAt ?? null,
      },
    });

    if (metadata.data.trackingNumber) {
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: 'RETURN_SHIPPED' },
      });
    }
  });

  await upsertOrderTrackingEvent(db, {
    orderId: returnRequest.orderId,
    status: 'SHIPPED',
    source: 'ADMIN',
    createdBy: actor.id,
    title: 'Return shipped',
    description: readString(body.description) || `Return ${returnId} shipped`,
    carrier: metadata.data.carrier ?? null,
    trackingNumber: metadata.data.trackingNumber ?? null,
  });

  return NextResponse.json({ status: 'RETURN_SHIPPED' });
}
