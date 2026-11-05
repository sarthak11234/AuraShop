import { OrderStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { canTransitionOrderStatus } from '@/lib/admin-order-status';
import { db } from '@/lib/db';
import { restoreReservedInventory } from '@/lib/order-cancellation';
import { parseTrackingMetadata, upsertOrderTrackingEvent } from '@/lib/order-tracking';
import {
  sendEmail,
  emailSubject,
  renderOrderShippedEmailHtml,
  renderOrderShippedEmailText,
  renderOrderDeliveredEmailHtml,
  renderOrderDeliveredEmailText,
} from '@/lib/email';

type RouteContext = { params: Promise<{ orderId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'order-read', 60);
  if (rateLimitResponse) return rateLimitResponse;
  const { orderId } = await params;

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        discount: true,
        shipping: true,
        tax: true,
        total: true,
        currency: true,
        shippingAddress: true,
        billingAddress: true,
        carrier: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        items: {
          select: {
            id: true,
            productTitle: true,
            productSlug: true,
            productImage: true,
            size: true,
            quantity: true,
            price: true,
            lineTotal: true,
          },
        },
        payment: {
          select: {
            provider: true,
            status: true,
            amount: true,
            currency: true,
            method: true,
            providerPaymentId: true,
            capturedAt: true,
          },
        },
        trackingEvents: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            title: true,
            description: true,
            location: true,
            source: true,
            carrier: true,
            trackingNumber: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    return NextResponse.json({
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shipping: Number(order.shipping),
      tax: Number(order.tax),
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        price: Number(item.price),
        lineTotal: Number(item.lineTotal),
      })),
      payment: order.payment
        ? { ...order.payment, amount: Number(order.payment.amount) }
        : null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      trackingEvents: order.trackingEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[GET /api/admin/orders/[orderId]]', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'order-status');
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

  const { status, reason } = body as { status?: unknown; reason?: unknown };
  if (typeof status !== 'string' || !Object.values(OrderStatus).includes(status as OrderStatus)) {
    return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
  }
  if (typeof reason !== 'string' || reason.trim().length < 8 || reason.trim().length > 500) {
    return NextResponse.json(
      { error: 'A reason between 8 and 500 characters is required' },
      { status: 400 },
    );
  }

  const metadataResult = parseTrackingMetadata(body);
  if (!metadataResult.ok) {
    return NextResponse.json({ error: metadataResult.error }, { status: 400 });
  }
  const metadata = metadataResult.data;
  const nextStatus = status as OrderStatus;
  const auditReason = reason.trim();

  try {
    const outcome = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          carrier: true,
          trackingNumber: true,
          trackingUrl: true,
          shippedAt: true,
          inventoryReservedAt: true,
          inventoryRestoredAt: true,
          items: {
            select: { variantId: true, productId: true, quantity: true },
          },
        },
      });
      if (!current) return { kind: 'missing' as const };
      if (!canTransitionOrderStatus(current.status, nextStatus)) {
        return { kind: 'invalid-transition' as const, current: current.status };
      }

      const shouldRestoreInventory =
        nextStatus === 'CANCELLED' &&
        Boolean(current.inventoryReservedAt) &&
        !current.inventoryRestoredAt;
      if (shouldRestoreInventory && current.items.some((item) => !item.variantId)) {
        return { kind: 'inventory-unavailable' as const };
      }

      const changedAt = new Date();
      const data: Prisma.OrderUpdateManyMutationInput = {
        status: nextStatus,
        ...(metadata.carrier !== undefined ? { carrier: metadata.carrier } : {}),
        ...(metadata.trackingNumber !== undefined
          ? { trackingNumber: metadata.trackingNumber }
          : {}),
        ...(metadata.trackingUrl !== undefined ? { trackingUrl: metadata.trackingUrl } : {}),
      };

      if (nextStatus === 'SHIPPED') {
        data.shippedAt = metadata.shippedAt ?? current.shippedAt ?? changedAt;
      }
      if (nextStatus === 'CANCELLED') {
        data.cancelledAt = changedAt;
        data.cancellationReason = auditReason;
        if (shouldRestoreInventory) data.inventoryRestoredAt = changedAt;
        if (current.paymentStatus === 'pending') data.paymentStatus = 'cancelled';
      }

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: current.status },
        data,
      });
      if (updated.count !== 1) return { kind: 'conflict' as const };

      if (shouldRestoreInventory) {
        await restoreReservedInventory(tx, {
          inventoryReservedAt: current.inventoryReservedAt,
          inventoryRestoredAt: current.inventoryRestoredAt,
          items: current.items,
        });
      }

      if (nextStatus === 'CANCELLED' && current.paymentStatus === 'pending') {
        await tx.payment.updateMany({
          where: { orderId, status: 'pending' },
          data: { status: 'cancelled' },
        });
      }

      await upsertOrderTrackingEvent(tx, {
        orderId,
        status: nextStatus,
        source: 'ADMIN',
        createdBy: actor.id,
        ...(metadata.description !== undefined
          ? { description: metadata.description }
          : nextStatus === 'CANCELLED'
            ? { description: 'This order was cancelled by VEXO support.' }
            : {}),
        ...(metadata.location !== undefined ? { location: metadata.location } : {}),
        carrier: metadata.carrier !== undefined ? metadata.carrier : current.carrier,
        trackingNumber:
          metadata.trackingNumber !== undefined
            ? metadata.trackingNumber
            : current.trackingNumber,
      });

      const afterCarrier =
        metadata.carrier !== undefined ? metadata.carrier : current.carrier;
      const afterTrackingNumber =
        metadata.trackingNumber !== undefined
          ? metadata.trackingNumber
          : current.trackingNumber;

      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'order.status_updated',
        entityType: 'order',
        entityId: orderId,
        reason: auditReason,
        before: {
          status: current.status,
          carrier: current.carrier,
          trackingNumber: current.trackingNumber,
        } satisfies Prisma.InputJsonObject,
        after: {
          status: nextStatus,
          carrier: afterCarrier,
          trackingNumber: afterTrackingNumber,
          ...(data.shippedAt instanceof Date
            ? { shippedAt: data.shippedAt.toISOString() }
            : {}),
        } satisfies Prisma.InputJsonObject,
      });

      return { kind: 'updated' as const, previousStatus: current.status };
    });

    if (outcome.kind === 'missing') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (outcome.kind === 'invalid-transition') {
      return NextResponse.json(
        { error: `Cannot change order status from ${outcome.current} to ${nextStatus}` },
        { status: 409 },
      );
    }
    if (outcome.kind === 'inventory-unavailable') {
      return NextResponse.json(
        {
          error:
            'This order has a legacy item without a variant reservation, so inventory cannot be restored automatically. Resolve stock manually before cancelling.',
          code: 'INVENTORY_UNAVAILABLE',
        },
        { status: 409 },
      );
    }
    if (outcome.kind === 'conflict') {
      return NextResponse.json(
        { error: 'Order changed during this update; reload and try again' },
        { status: 409 },
      );
    }


    // Send order status email notifications (fire-and-forget)
    void (async () => {
      try {
        const fullOrder = await db.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            status: true,
            total: true,
            currency: true,
            shippingAddress: true,
            createdAt: true,
            updatedAt: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            shippedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });
        if (!fullOrder?.user?.email) return;

        const customerName = fullOrder.user.name;

        if (nextStatus === 'SHIPPED') {
          await sendEmail({
            to: fullOrder.user.email,
            subject: emailSubject(
              `Your VEXO order is on its way — ${fullOrder.orderNumber}`,
            ),
            html: renderOrderShippedEmailHtml({
              orderNumber: fullOrder.orderNumber,
              orderDate: fullOrder.createdAt,
              customerName,
              carrier: fullOrder.carrier,
              trackingNumber: fullOrder.trackingNumber,
              trackingUrl: fullOrder.trackingUrl,
              shippedAt: fullOrder.shippedAt,
              total: Number(fullOrder.total),
              currency: fullOrder.currency,
              appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            }),
            text: renderOrderShippedEmailText({
              orderNumber: fullOrder.orderNumber,
              orderDate: fullOrder.createdAt,
              customerName,
              carrier: fullOrder.carrier,
              trackingNumber: fullOrder.trackingNumber,
              trackingUrl: fullOrder.trackingUrl,
              shippedAt: fullOrder.shippedAt,
              total: Number(fullOrder.total),
              currency: fullOrder.currency,
              appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            }),
          });
        } else if (nextStatus === 'DELIVERED') {
          await sendEmail({
            to: fullOrder.user.email,
            subject: emailSubject(
              `Your VEXO order has arrived — ${fullOrder.orderNumber}`,
            ),
            html: renderOrderDeliveredEmailHtml({
              orderNumber: fullOrder.orderNumber,
              orderDate: fullOrder.createdAt,
              customerName,
              deliveredAt: fullOrder.shippedAt,
              total: Number(fullOrder.total),
              currency: fullOrder.currency,
              appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            }),
            text: renderOrderDeliveredEmailText({
              orderNumber: fullOrder.orderNumber,
              orderDate: fullOrder.createdAt,
              customerName,
              deliveredAt: fullOrder.shippedAt,
              total: Number(fullOrder.total),
              currency: fullOrder.currency,
              appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            }),
          });
        }
      } catch (error) {
        console.error('[sendOrderStatusEmail]', error);
      }
    })();

    return NextResponse.json({
      success: true,
      previousStatus: outcome.previousStatus,
      status: nextStatus,
    });
  } catch (error) {
    console.error('[PATCH /api/admin/orders/[orderId]]', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
