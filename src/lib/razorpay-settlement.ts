import { OrderStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { upsertOrderTrackingEvent } from '@/lib/order-tracking';

export class InventorySettlementError extends Error {}

export async function settleCapturedRazorpayPayment({
  providerOrderId,
  providerPaymentId,
  amount,
  currency,
  signature,
}: {
  providerOrderId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
  signature?: string;
}): Promise<'settled' | 'already-settled' | 'not-found'> {
  const payment = await db.payment.findFirst({
    where: { providerOrderId },
    include: { order: { include: { items: true } } },
  });
  if (!payment || payment.provider !== 'razorpay' || !payment.order) return 'not-found';

  const expectedAmount = Math.round(Number(payment.order.total) * 100);
  if (amount !== expectedAmount || currency !== payment.order.currency) {
    throw new Error('Razorpay payment amount or currency does not match the order.');
  }
  if (
    (payment.status === 'captured' || payment.status === 'verified') &&
    payment.providerPaymentId !== providerPaymentId
  ) {
    throw new Error('A different payment is already associated with this order.');
  }
  if (payment.status === 'captured' || payment.status === 'verified') {
    return 'already-settled';
  }

  const settledAt = new Date();
  await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { notIn: ['captured', 'verified'] } },
      data: {
        providerPaymentId,
        ...(signature ? { providerSignature: signature } : {}),
        status: 'captured',
        verifiedAt: settledAt,
        capturedAt: settledAt,
      },
    });
    if (claimed.count !== 1) return;

    for (const item of payment.order.items) {
      if (!item.variantId) {
        throw new InventorySettlementError('Order inventory cannot be confirmed for a legacy item.');
      }
      const updated = await tx.productVariant.updateMany({
        where: { id: item.variantId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count !== 1) {
        throw new InventorySettlementError('Inventory changed before payment confirmation. Contact support for a refund.');
      }
      const remainingStock = await tx.productVariant.count({
        where: { productId: item.productId, stock: { gt: 0 } },
      });
      await tx.product.update({
        where: { id: item.productId },
        data: { inStock: remainingStock > 0 },
      });
    }

    await tx.order.update({
      where: { id: payment.order.id },
      data: {
        status: OrderStatus.CONFIRMED,
        paymentStatus: 'paid',
        inventoryReservedAt: settledAt,
      },
    });

    await upsertOrderTrackingEvent(tx, {
      orderId: payment.order.id,
      status: OrderStatus.CONFIRMED,
      source: 'SYSTEM',
      title: 'Order confirmed',
      description: 'Payment was captured successfully.',
    });
  });

  const latest = await db.payment.findUnique({
    where: { id: payment.id },
    select: { status: true, providerPaymentId: true },
  });
  if (latest?.status !== 'captured' || latest.providerPaymentId !== providerPaymentId) {
    return 'already-settled';
  }
  return 'settled';
}
