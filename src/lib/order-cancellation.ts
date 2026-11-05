import { Prisma } from '@prisma/client';
import { getCancellationEligibility } from '@/lib/order-lifecycle';
import { upsertOrderTrackingEvent } from '@/lib/order-tracking';
import { db } from '@/lib/db';

export class CancellationInventoryError extends Error {}

type CancellationItem = {
  variantId: string | null;
  productId: string;
  quantity: number;
};

/**
 * Returns reserved units to the catalogue. The caller is responsible for
 * marking inventoryRestoredAt in the same transaction.
 */
export async function restoreReservedInventory(
  tx: Prisma.TransactionClient,
  order: {
    inventoryReservedAt: Date | null;
    inventoryRestoredAt: Date | null;
    items: CancellationItem[];
  },
): Promise<boolean> {
  if (!order.inventoryReservedAt || order.inventoryRestoredAt) return false;
  if (order.items.some((item) => !item.variantId)) {
    throw new CancellationInventoryError(
      'Order contains a legacy item without a variant reservation; inventory cannot be restored automatically.',
    );
  }

  for (const item of order.items) {
    await tx.productVariant.update({
      where: { id: item.variantId! },
      data: { stock: { increment: item.quantity } },
    });
    await tx.product.update({
      where: { id: item.productId },
      data: { inStock: true },
    });
  }
  return true;
}

export type CustomerCancellationResult =
  | { kind: 'cancelled'; cancelledAt: Date }
  | { kind: 'already-cancelled'; cancelledAt: Date | null }
  | { kind: 'not-found' }
  | { kind: 'not-eligible'; code: string; reason: string }
  | { kind: 'conflict' }
  | { kind: 'inventory-unavailable'; reason: string };

/**
 * Customer-initiated cancellation. Ownership is part of the lookup, the status
 * transition is claimed with an atomic update, inventory is restored only when
 * a known COD reservation exists, and no refund is fabricated.
 */
export async function cancelCustomerOrder({
  userId,
  orderId,
  reason,
}: {
  userId: string;
  orderId: string;
  reason: string;
}): Promise<CustomerCancellationResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        cancelledAt: true,
        paymentStatus: true,
        inventoryReservedAt: true,
        inventoryRestoredAt: true,
        items: {
          select: { variantId: true, productId: true, quantity: true },
        },
        payment: {
          select: { id: true, provider: true, status: true, providerOrderId: true },
        },
      },
    });

    if (!order) return { kind: 'not-found' as const };

    const eligibility = getCancellationEligibility({
      status: order.status,
      cancelledAt: order.cancelledAt,
      paymentStatus: order.paymentStatus,
      inventoryReservedAt: order.inventoryReservedAt,
      payment: order.payment
        ? {
            provider: order.payment.provider,
            status: order.payment.status,
            providerOrderId: order.payment.providerOrderId,
          }
        : null,
    });

    if (eligibility.alreadyCancelled) {
      return { kind: 'already-cancelled' as const, cancelledAt: order.cancelledAt };
    }
    if (!eligibility.eligible) {
      return {
        kind: 'not-eligible' as const,
        code: eligibility.code,
        reason: eligibility.reason,
      };
    }
    if (order.inventoryReservedAt && order.items.some((item) => !item.variantId)) {
      return {
        kind: 'inventory-unavailable' as const,
        reason:
          'The inventory reservation for this order cannot be restored automatically. Contact support.',
      };
    }

    const cancelledAt = new Date();
    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        userId,
        status: order.status,
        cancelledAt: null,
      },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'cancelled',
        cancelledAt,
        cancellationReason: reason,
        ...(order.inventoryReservedAt ? { inventoryRestoredAt: cancelledAt } : {}),
      },
    });
    if (claimed.count !== 1) return { kind: 'conflict' as const };

    if (order.inventoryReservedAt) {
      await restoreReservedInventory(tx, order);
    }

    if (order.payment) {
      await tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: {
            notIn: ['captured', 'verified', 'refunded', 'partially_refunded'],
          },
        },
        data: { status: 'cancelled' },
      });
    }

    await upsertOrderTrackingEvent(tx, {
      orderId: order.id,
      status: 'CANCELLED',
      source: 'CUSTOMER',
      createdBy: userId,
      description: reason,
    });

    return { kind: 'cancelled' as const, cancelledAt };
  });
}
