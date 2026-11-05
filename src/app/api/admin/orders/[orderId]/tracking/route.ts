import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { db } from '@/lib/db';
import { parseTrackingMetadata, upsertOrderTrackingEvent } from '@/lib/order-tracking';

type RouteContext = { params: Promise<{ orderId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Manual shipment metadata. This endpoint never invents a carrier, tracking
 * number or delivery estimate; it only persists values entered by an
 * authorized administrator and records an audit entry.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'order-tracking', 20);
  if (rateLimitResponse) return rateLimitResponse;
  const { orderId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const metadataResult = parseTrackingMetadata(body);
  if (!metadataResult.ok) {
    return NextResponse.json({ error: metadataResult.error }, { status: 400 });
  }
  const metadata = metadataResult.data;
  const hasMetadata = Object.keys(metadata).length > 0;
  if (!hasMetadata) {
    return NextResponse.json({ error: 'No tracking fields were provided' }, { status: 400 });
  }

  try {
    const outcome = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          carrier: true,
          trackingNumber: true,
          trackingUrl: true,
          shippedAt: true,
        },
      });
      if (!current) return { kind: 'missing' as const };

      const data: Prisma.OrderUpdateInput = {
        ...(metadata.carrier !== undefined ? { carrier: metadata.carrier } : {}),
        ...(metadata.trackingNumber !== undefined
          ? { trackingNumber: metadata.trackingNumber }
          : {}),
        ...(metadata.trackingUrl !== undefined ? { trackingUrl: metadata.trackingUrl } : {}),
        ...(metadata.shippedAt !== undefined ? { shippedAt: metadata.shippedAt } : {}),
      };

      const updated = await tx.order.update({
        where: { id: orderId },
        data,
        select: {
          carrier: true,
          trackingNumber: true,
          trackingUrl: true,
          shippedAt: true,
        },
      });

      // Only reflect an existing shipped state. No shipment event is created
      // while the order is still pre-shipment.
      const shipped = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY'].includes(
        current.status,
      );
      if (shipped) {
        await upsertOrderTrackingEvent(tx, {
          orderId,
          status: 'SHIPPED',
          source: 'ADMIN',
          createdBy: actor.id,
          ...(metadata.description !== undefined ? { description: metadata.description } : {}),
          ...(metadata.location !== undefined ? { location: metadata.location } : {}),
          carrier:
            metadata.carrier !== undefined ? metadata.carrier : updated.carrier,
          trackingNumber:
            metadata.trackingNumber !== undefined
              ? metadata.trackingNumber
              : updated.trackingNumber,
        });
      }

      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'order.tracking_updated',
        entityType: 'order',
        entityId: orderId,
        before: {
          carrier: current.carrier,
          trackingNumber: current.trackingNumber,
          trackingUrl: current.trackingUrl,
          shippedAt: current.shippedAt?.toISOString() ?? null,
        } satisfies Prisma.InputJsonObject,
        after: {
          carrier: updated.carrier,
          trackingNumber: updated.trackingNumber,
          trackingUrl: updated.trackingUrl,
          shippedAt: updated.shippedAt?.toISOString() ?? null,
        } satisfies Prisma.InputJsonObject,
      });

      return { kind: 'updated' as const, shipped, updated };
    });

    if (outcome.kind === 'missing') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      carrier: outcome.updated.carrier,
      trackingNumber: outcome.updated.trackingNumber,
      trackingUrl: outcome.updated.trackingUrl,
      shippedAt: outcome.updated.shippedAt?.toISOString() ?? null,
      shipmentEventRecorded: outcome.shipped,
    });
  } catch (error) {
    console.error('[PATCH /api/admin/orders/[orderId]/tracking]', error);
    return NextResponse.json({ error: 'Failed to update tracking details' }, { status: 500 });
  }
}
