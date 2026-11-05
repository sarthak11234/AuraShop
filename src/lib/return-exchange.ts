import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { writeAdminAudit } from '@/lib/admin';
import { rateLimitActorAction } from '@/lib/rate-limit';
import {
  returnStatusLabel,
  type ExchangeStatus,
  type ReturnStatus,
} from '@/lib/return-lifecycle';

export type ExchangeResult =
  | { kind: 'created'; exchangeRequest: Prisma.ExchangeRequestGetPayload<object> }
  | { kind: 'not-eligible'; reason: string }
  | { kind: 'not-found' }
  | { kind: 'conflict' };

export async function createExchangeRequest({
  actorId,
  returnRequestId,
  replacementProductId,
  replacementVariantId,
  replacementQuantity,
}: {
  actorId: string;
  returnRequestId: string;
  replacementProductId: string;
  replacementVariantId?: string | null;
  replacementQuantity: number;
}): Promise<ExchangeResult> {
  return db.$transaction(async (tx) => {
    const rateLimit = await rateLimitActorAction(
      actorId,
      'return-exchange',
      10,
      60_000,
    );
    if (rateLimit) {
      throw new Error('Too many exchange requests; try again shortly.');
    }

    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { order: true, exchangeRequest: true, items: true },
    });
    if (!returnRequest) return { kind: 'not-found' };

    if (returnRequest.returnType !== 'EXCHANGE') {
      return { kind: 'not-eligible', reason: 'This return is not an exchange request.' };
    }
    if (returnRequest.exchangeRequest) {
      return { kind: 'conflict' };
    }

    const product = await tx.product.findUnique({
      where: { id: replacementProductId },
      include: { variants: true },
    });
    if (!product || !product.isPublished || product.archivedAt) {
      return { kind: 'not-eligible', reason: 'Replacement product is not available.' };
    }

    const variant =
      replacementVariantId &&
      product.variants.find((v) => v.id === replacementVariantId);
    if (replacementVariantId && !variant) {
      return { kind: 'not-eligible', reason: 'Replacement variant not found.' };
    }
    if (
      replacementVariantId &&
      variant &&
      variant.stock < replacementQuantity
    ) {
      return { kind: 'not-eligible', reason: 'Insufficient replacement stock.' };
    }

    const priceDifference: number | null =
      variant && variant.price !== null
        ? Math.round(Number(variant.price) * 100) / 100
        : null;

    const exchangeRequest = await tx.exchangeRequest.create({
      data: {
        returnRequestId,
        userId: returnRequest.userId,
        orderId: returnRequest.orderId,
        status: 'PENDING' as ExchangeStatus,
        replacementProductId,
        replacementVariantId: replacementVariantId ?? null,
        replacementQuantity,
        priceDifference:
          priceDifference !== null ? new Prisma.Decimal(priceDifference) : null,
      },
    });

    await tx.returnRequest.update({
      where: { id: returnRequestId },
      data: { status: 'EXCHANGE_PENDING' as ReturnStatus },
    });

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId,
        status: 'EXCHANGE_PENDING' as ReturnStatus,
        title: 'Exchange requested',
        source: 'CUSTOMER',
        actorId,
        description: `Exchange requested for ${product.title}.`,
      },
    });

    await writeAdminAudit(tx, {
      actorId,
      action: 'return.exchange.requested',
      entityType: 'return',
      entityId: returnRequestId,
      reason: `Replacement: ${product.title} x ${replacementQuantity}`,
    });

    return {
      kind: 'created',
      exchangeRequest,
    };
  });
}

export async function approveExchange({
  actorId,
  returnRequestId,
}: {
  actorId: string;
  returnRequestId: string;
}): Promise<
  | { kind: 'approved' }
  | { kind: 'not-found' }
  | { kind: 'not-eligible'; reason: string }
  | { kind: 'conflict' }
> {
  return db.$transaction(async (tx) => {
    const rateLimit = await rateLimitActorAction(
      actorId,
      'return-exchange-approve',
      10,
      60_000,
    );
    if (rateLimit) {
      throw new Error('Too many requests; try again shortly.');
    }

    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { exchangeRequest: { include: { replacementVariant: true } } },
    });
    if (!returnRequest) return { kind: 'not-found' };

    const exchange = returnRequest.exchangeRequest;
    if (!exchange) {
      return { kind: 'not-eligible', reason: 'No exchange request linked to this return.' };
    }
    if (
      returnRequest.status !== 'EXCHANGE_PENDING' &&
      returnRequest.status !== 'INSPECTED'
    ) {
      return {
        kind: 'not-eligible',
        reason: `Exchange requires an inspected return (current: ${returnStatusLabel(returnRequest.status)}).`,
      };
    }

    const variant = exchange.replacementVariant;
    if (!variant || variant.stock < exchange.replacementQuantity) {
      return { kind: 'not-eligible', reason: 'Insufficient replacement stock to approve exchange.' };
    }

    const updated = await tx.productVariant.updateMany({
      where: {
        id: variant.id,
        stock: { gte: exchange.replacementQuantity },
      },
      data: { stock: { decrement: exchange.replacementQuantity } },
    });
    if (updated.count !== 1) {
      return { kind: 'not-eligible', reason: 'Replacement stock changed before approval.' };
    }

    const claimed = await tx.returnRequest.updateMany({
      where: { id: returnRequestId, status: returnRequest.status },
      data: { status: 'EXCHANGE_PROCESSING' as ReturnStatus },
    });
    if (claimed.count !== 1) return { kind: 'conflict' };

    await tx.exchangeRequest.update({
      where: { id: exchange.id },
      data: {
        status: 'STOCK_RESERVED' as ExchangeStatus,
        reservedAt: new Date(),
      },
    });

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId,
        status: 'EXCHANGE_PROCESSING' as ReturnStatus,
        title: returnStatusLabel('EXCHANGE_PROCESSING'),
        source: 'ADMIN',
        actorId,
        description: `Exchange approved; ${exchange.replacementQuantity} replacement unit(s) reserved.`,
      },
    });

    await writeAdminAudit(tx, {
      actorId,
      action: 'return.exchange.approved',
      entityType: 'return',
      entityId: returnRequestId,
      reason: `${exchange.replacementQuantity} replacement unit(s) reserved`,
    });

    return { kind: 'approved' };
  });
}

export async function completeExchange({
  actorId,
  returnRequestId,
}: {
  actorId: string;
  returnRequestId: string;
}): Promise<
  | { kind: 'completed' }
  | { kind: 'not-found' }
  | { kind: 'not-eligible'; reason: string }
> {
  return db.$transaction(async (tx) => {
    const returnRequest = await tx.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { exchangeRequest: true },
    });
    if (!returnRequest) return { kind: 'not-found' };

    const exchange = returnRequest.exchangeRequest;
    if (!exchange || exchange.status !== 'STOCK_RESERVED') {
      return { kind: 'not-eligible', reason: 'Exchange stock has not been reserved.' };
    }

    const claimed = await tx.returnRequest.updateMany({
      where: { id: returnRequestId, status: 'EXCHANGE_PROCESSING' },
      data: { status: 'EXCHANGED' as ReturnStatus },
    });
    if (claimed.count !== 1) return { kind: 'not-eligible', reason: 'Exchange not in processing state.' };

    await tx.exchangeRequest.update({
      where: { id: exchange.id },
      data: { status: 'COMPLETED' as ExchangeStatus },
    });

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId,
        status: 'EXCHANGED' as ReturnStatus,
        title: returnStatusLabel('EXCHANGED'),
        source: 'ADMIN',
        actorId,
        description: 'Exchange completed; replacement dispatched.',
      },
    });

    await writeAdminAudit(tx, {
      actorId,
      action: 'return.exchange.completed',
      entityType: 'return',
      entityId: returnRequestId,
    });

    return { kind: 'completed' };
  });
}
