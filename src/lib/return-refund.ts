import { Prisma, type ReturnStatus } from '@prisma/client';
import { createRazorpayRefund, isRazorpayConfigured } from '@/lib/payment';
import { db } from '@/lib/db';
import { writeAdminAudit } from '@/lib/admin';
import { rateLimitActorAction } from '@/lib/rate-limit';
import { returnStatusLabel } from '@/lib/return-lifecycle';

/** Monetary amounts are handled in minor currency units (cents) as integers. */
export type MoneyCents = number;

export interface RefundCalculation {
  /** Total refundable amount in cents for the approved return. */
  refundableCents: MoneyCents;
  /** Already refunded amount in cents. */
  alreadyRefundedCents: MoneyCents;
  /** Remaining refundable amount in cents. */
  remainingCents: MoneyCents;
  /** Per-item breakdown. */
  items: Array<{
    returnItemId: string;
    productTitle: string;
    approvedQuantity: number;
    unitPriceCents: MoneyCents;
    lineTotalCents: MoneyCents;
    refundableCents: MoneyCents;
  }>;
  breakdown: {
    subtotalCents: MoneyCents;
    discountCents: MoneyCents;
    shippingCents: MoneyCents;
    taxCents: MoneyCents;
  };
}

/** Result of initiating a refund. */
export type RefundResult =
  | { kind: 'initiated'; refundId: string | number; providerRefundId: string | null; status: string }
  | { kind: 'already-refunded'; refundId: string | number }
  | { kind: 'not-eligible'; reason: string }
  | { kind: 'not-found' }
  | { kind: 'gateway-unavailable'; reason: string }
  | { kind: 'gateway-error'; reason: string }
  | { kind: 'conflict' };

/**
 * Calculates the server-side refundable amount for a return request.
 * Never trusts client-provided amounts; derives everything from persisted
 * order, item, and refund records.
 */
export async function calculateRefundableAmount({
  returnRequestId,
}: {
  returnRequestId: string;
}): Promise<RefundCalculation> {
  const returnRequest = await db.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: {
      order: {
        include: {
          items: true,
          payment: true,
          refunds: true,
        },
      },
      items: true,
    },
  });
  if (!returnRequest) {
    throw new Error('Return request not found.');
  }

  const order = returnRequest.order;

  // Sum of approved return item line totals (historical prices).
  let approvedLineTotalCents = 0;
  const itemBreakdown: RefundCalculation['items'] = [];
  for (const item of returnRequest.items) {
    if (item.approvedQuantity < 1) continue;
    const unitPriceCents = Math.round(Number(item.price) * 100);
    const lineTotalCents = unitPriceCents * item.approvedQuantity;
    approvedLineTotalCents += lineTotalCents;
    itemBreakdown.push({
      returnItemId: item.id,
      productTitle: item.productTitle,
      approvedQuantity: item.approvedQuantity,
      unitPriceCents,
      lineTotalCents,
      refundableCents: lineTotalCents,
    });
  }

  // Allocate discount/shipping/tax proportionally to the returned subtotal.
  const orderSubtotalCents = Math.round(Number(order.subtotal) * 100);
  const orderDiscountCents = Math.round(Number(order.discount) * 100);
  const orderShippingCents = Math.round(Number(order.shipping) * 100);
  const orderTaxCents = Math.round(Number(order.tax) * 100);

  let discountCents = 0;
  let shippingCents = 0;
  let taxCents = 0;
  if (orderSubtotalCents > 0 && approvedLineTotalCents > 0) {
    const ratio = approvedLineTotalCents / orderSubtotalCents;
    discountCents = Math.round(orderDiscountCents * ratio);
    shippingCents = Math.round(orderShippingCents * ratio);
    taxCents = Math.round(orderTaxCents * ratio);
  }

  const refundableCents =
    approvedLineTotalCents - discountCents + shippingCents + taxCents;

  const alreadyRefundedCents = returnRequest.order.refunds.reduce(
    (sum, r) => sum + (r.status === 'COMPLETED' ? Math.round(Number(r.amount) * 100) : 0),
    0,
  );

  return {
    refundableCents: Math.max(0, refundableCents),
    alreadyRefundedCents,
    remainingCents: Math.max(0, refundableCents - alreadyRefundedCents),
    items: itemBreakdown,
    breakdown: {
      subtotalCents: approvedLineTotalCents,
      discountCents,
      shippingCents,
      taxCents,
    },
  };
}

/**
 * Initiates a refund for an approved, inspected return.
 * For Razorpay payments, calls the existing gateway refund service.
 * For COD payments, creates an OfflineRefund record (manual workflow).
 * Idempotent: a completed refund for the same return blocks duplicates.
 */
export async function initiateRefund({
  actorId,
  returnRequestId,
  reason,
}: {
  actorId: string;
  returnRequestId: string;
  reason?: string | null;
}): Promise<RefundResult> {
  return db.$transaction(async (tx) => {
    const rateLimit = await rateLimitActorAction(
      actorId,
      'return-refund',
      5,
      60_000,
    );
    if (rateLimit) {
      throw new Error('Too many refund requests; try again shortly.');
    }

    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: { include: { payment: true, refunds: true } },
        offlineRefund: true,
      },
    });
    if (!returnRequest) return { kind: 'not-found' };

    if (
      returnRequest.status !== 'INSPECTED' &&
      returnRequest.status !== 'REFUND_PENDING'
    ) {
      return {
        kind: 'not-eligible',
        reason: `Refunds require an inspected return (current: ${returnStatusLabel(returnRequest.status)}).`,
      };
    }

    // Idempotency: an existing completed refund blocks duplicates.
    const existingRefund = returnRequest.order.refunds.find(
      (r) => r.status === 'COMPLETED' || r.status === 'PROCESSING',
    );
    if (existingRefund) {
      return { kind: 'already-refunded', refundId: existingRefund.id };
    }
    if (returnRequest.offlineRefund?.status === 'COMPLETED') {
      return { kind: 'already-refunded', refundId: returnRequest.offlineRefund.id };
    }

    const calculation = await calculateRefundableAmount({ returnRequestId });
    if (calculation.remainingCents <= 0) {
      return { kind: 'not-eligible', reason: 'No refundable balance remains.' };
    }

    const payment = returnRequest.order.payment;
    const isCod = payment?.provider === 'cod';
    const isCapturedOnline =
      payment &&
      payment.provider === 'razorpay' &&
      (payment.status === 'captured' || payment.status === 'verified') &&
      Boolean(payment.providerPaymentId);

    // --- Razorpay refund path ---
    if (isCapturedOnline && isRazorpayConfigured()) {
      const claimed = await tx.returnRequest.updateMany({
        where: {
          id: returnRequestId,
          status: { in: ['INSPECTED', 'REFUND_PENDING'] },
        },
        data: {
          status: 'REFUND_PROCESSING' as ReturnStatus,
          refundAmount: new Prisma.Decimal(calculation.remainingCents / 100),
        },
      });
      if (claimed.count !== 1) return { kind: 'conflict' };

      try {
        const gateway = await createRazorpayRefund({
          paymentId: payment!.providerPaymentId!,
          amountInCents: calculation.remainingCents,
          notes: { returnRequestId, reason: reason ?? '' },
        });

        const refund = await tx.refund.create({
          data: {
            orderId: returnRequest.order.id,
            paymentId: payment!.id,
            amount: new Prisma.Decimal(calculation.remainingCents / 100),
            currency: returnRequest.order.currency,
            status: 'pending',
            providerRefundId: gateway.id,
            gatewayResponse: gateway as unknown as Prisma.InputJsonValue,
            actorId,
            reason: reason ?? null,
          },
        });

        await tx.returnStatusEvent.create({
          data: {
            returnRequestId,
            status: 'REFUND_PROCESSING' as ReturnStatus,
            title: returnStatusLabel('REFUND_PROCESSING'),
            source: 'ADMIN',
            actorId,
            description: `Razorpay refund initiated: ${gateway.id}`,
          },
        });

        await writeAdminAudit(tx, {
          actorId,
          action: 'return.refund.initiated',
          entityType: 'return',
          entityId: returnRequestId,
          reason: `Amount: ${calculation.remainingCents / 100} ${returnRequest.order.currency}`,
        });

        return {
          kind: 'initiated',
          refundId: refund.id,
          providerRefundId: gateway.id,
          status: 'pending',
        };
      } catch (error) {
        // Roll back the status change on gateway failure — do not fabricate success.
        await tx.returnRequest.updateMany({
          where: { id: returnRequestId, status: 'REFUND_PROCESSING' },
          data: { status: 'INSPECTED' as ReturnStatus },
        });
        await writeAdminAudit(tx, {
          actorId,
          action: 'return.refund.failed',
          entityType: 'return',
          entityId: returnRequestId,
          reason: error instanceof Error ? error.message : 'Gateway error',
        });
        return {
          kind: 'gateway-error',
          reason: error instanceof Error ? error.message : 'Razorpay refund failed.',
        };
      }
    }

    // --- Razorpay not configured / not captured online ---
    if (isCapturedOnline && !isRazorpayConfigured()) {
      return {
        kind: 'gateway-unavailable',
        reason: 'Razorpay credentials are not configured. Refund cannot be processed until credentials are set.',
      };
    }

    // --- COD offline refund path ---
    if (isCod) {
      // COD refunds go through a distinct offline workflow.
      const offlineRefund = await tx.offlineRefund.create({
        data: {
          orderId: returnRequest.order.id,
          returnRequestId,
          amount: new Prisma.Decimal(calculation.remainingCents / 100),
          currency: returnRequest.order.currency,
          method: 'BANK_TRANSFER',
          transactionReference: `MANUAL-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
          status: 'PENDING',
          actorId,
          notes: reason ?? null,
        },
      });

      await tx.returnRequest.updateMany({
        where: { id: returnRequestId },
        data: {
          status: 'REFUND_PENDING' as ReturnStatus,
          refundAmount: new Prisma.Decimal(calculation.remainingCents / 100),
        },
      });

      await tx.returnStatusEvent.create({
        data: {
          returnRequestId,
          status: 'REFUND_PENDING' as ReturnStatus,
          title: returnStatusLabel('REFUND_PENDING'),
          source: 'ADMIN',
          actorId,
          description: 'COD offline refund requested (manual payout).',
        },
      });

      await writeAdminAudit(tx, {
        actorId,
        action: 'return.refund.offline.requested',
        entityType: 'return',
        entityId: returnRequestId,
        reason: `Amount: ${calculation.remainingCents / 100} ${returnRequest.order.currency}`,
      });

      return {
        kind: 'initiated',
        refundId: offlineRefund.id,
        providerRefundId: null,
        status: 'pending',
      };
    }

    return {
      kind: 'not-eligible',
      reason: 'No refundable online payment or COD refund path is available for this return.',
    };
  });
}

/**
 * Confirms a Razorpay refund via webhook/reconciliation. Only marks complete
 * when the gateway has confirmed the refund.
 */
export async function confirmRazorpayRefund({
  providerRefundId,
  status,
  gatewayResponse,
}: {
  providerRefundId: string;
  status: 'completed' | 'failed';
  gatewayResponse: Prisma.InputJsonValue;
}) {
  return db.$transaction(async (tx) => {
    const refund = await tx.refund.findFirst({
      where: { providerRefundId },
      include: { order: true },
    });
    if (!refund) return { kind: 'not-found' as const };

    const newStatus = status === 'completed' ? 'completed' : 'failed';
    const updated = await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: newStatus,
        gatewayResponse: gatewayResponse as Prisma.InputJsonValue,
        ...(status === 'completed' ? { verifiedAt: new Date() } : {}),
      },
    });

    // Update the linked return request.
    const returnRequest = await tx.returnRequest.findFirst({
      where: { orderId: refund.orderId },
    });
    if (returnRequest) {
      const finalReturnStatus =
        status === 'completed' ? ('REFUNDED' as ReturnStatus) : ('INSPECTED' as ReturnStatus);
      await tx.returnRequest.update({
        where: { id: returnRequest.id },
        data: { status: finalReturnStatus },
      });
      await tx.returnStatusEvent.create({
        data: {
          returnRequestId: returnRequest.id,
          status: finalReturnStatus,
          title: returnStatusLabel(finalReturnStatus),
          source: 'SYSTEM',
          description: `Razorpay refund ${status}.`,
        },
      });
    }

    return { kind: 'confirmed', refund: updated };
  });
}

/**
 * Completes a COD offline refund once the admin supplies verification evidence
 * (transaction reference, etc.). Requires explicit actor confirmation.
 */
export async function completeOfflineRefund({
  offlineRefundId,
  actorId,
  transactionReference,
  notes,
}: {
  offlineRefundId: string;
  actorId: string;
  transactionReference: string;
  notes?: string | null;
}) {
  return db.$transaction(async (tx) => {
    const offlineRefund = await tx.offlineRefund.findUnique({
      where: { id: offlineRefundId },
      include: { returnReq: true },
    });
    if (!offlineRefund) return { kind: 'not-found' as const };
    if (offlineRefund.status !== 'PENDING' && offlineRefund.status !== 'PROCESSING') {
      return { kind: 'not-eligible', reason: 'Offline refund is not in a completable state.' };
    }

    const updated = await tx.offlineRefund.update({
      where: { id: offlineRefundId },
      data: {
        status: 'COMPLETED',
        transactionReference,
        notes: notes ?? offlineRefund.notes,
        verifiedAt: new Date(),
        actorId,
      },
    });

    const returnRequest = offlineRefund.returnReq;
    if (returnRequest) {
      await tx.returnRequest.update({
        where: { id: returnRequest.id },
        data: { status: 'REFUNDED' as ReturnStatus },
      });
      await tx.returnStatusEvent.create({
        data: {
          returnRequestId: returnRequest.id,
          status: 'REFUNDED' as ReturnStatus,
          title: returnStatusLabel('REFUNDED'),
          source: 'ADMIN',
          actorId,
          description: `COD offline refund completed: ${transactionReference}`,
        },
      });
    }

    await writeAdminAudit(tx, {
      actorId,
      action: 'return.refund.offline.completed',
      entityType: 'offline-refund',
      entityId: offlineRefundId,
      reason: transactionReference,
    });

    return { kind: 'completed', offlineRefund: updated };
  });
}
