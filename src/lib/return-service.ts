import { Prisma, type ReturnStatus } from '@prisma/client';
import { returnStatusLabel } from '@/lib/return-lifecycle';
import { evaluateReturnEligibility } from '@/lib/return-policy';
import { db } from '@/lib/db';
import { writeAdminAudit } from '@/lib/admin';
import { rateLimitActorAction } from '@/lib/rate-limit';

export type ReturnItemInput = {
  orderItemId: number;
  quantity: number;
};

export type CreateReturnInput = {
  orderId: string;
  returnReason: string;
  returnType: 'REFUND' | 'EXCHANGE';
  customerComments?: string | null;
  items: ReturnItemInput[];
};

export type CreateReturnResult =
  | { kind: 'created'; returnRequest: Prisma.ReturnRequestGetPayload<{ include: { items: true } }> }
  | { kind: 'not-eligible'; reasons: string[] }
  | { kind: 'not-found' }
  | { kind: 'conflict' };

export async function createReturnRequest({
  userId,
  input,
}: {
  userId: string;
  input: CreateReturnInput;
}): Promise<CreateReturnResult> {
  return db.$transaction(async (tx) => {
    const rateLimit = await rateLimitActorAction(
      userId,
      'return-create',
      10,
      60_000,
    );
    if (rateLimit) {
      throw new Error('Too many return requests; try again shortly.');
    }

    const eligibility = await evaluateReturnEligibility({
      orderId: input.orderId,
      userId,
    });
    if (!eligibility.eligible) {
      return { kind: 'not-eligible', reasons: eligibility.reasons };
    }

    const order = await tx.order.findFirst({
      where: { id: input.orderId, userId },
      include: {
        items: {
          include: {
            product: { select: { category: true } },
            returnItems: {
              select: { requestedQuantity: true, approvedQuantity: true },
            },
          },
        },
        returnRequests: {
          select: { id: true, status: true },
        },
      },
    });
    if (!order) return { kind: 'not-found' };

    const itemEligibilityMap = new Map(
      eligibility.items.map((i) => [i.orderItemId, i]),
    );

    const returnItems: Array<unknown> = [];
    for (const itemInput of input.items) {
      const orderItem = order.items.find((i) => i.id === itemInput.orderItemId);
      if (!orderItem) {
        return {
          kind: 'not-eligible',
          reasons: [`Item ${itemInput.orderItemId} was not purchased in this order.`],
        };
      }

      const eligibilityItem = itemEligibilityMap.get(orderItem.id);
      if (!eligibilityItem || !eligibilityItem.eligibility.eligible) {
        return {
          kind: 'not-eligible',
          reasons: [
            `Item "${orderItem.productTitle}" is not eligible for return.` +
              (eligibilityItem?.eligibility.reasons.length
                ? ` ${eligibilityItem.eligibility.reasons.join(' ')}`
                : ''),
          ],
        };
      }

      if (
        !Number.isInteger(itemInput.quantity) ||
        itemInput.quantity < 1 ||
        itemInput.quantity > eligibilityItem.eligibility.maxReturnableQuantity
      ) {
        return {
          kind: 'not-eligible',
          reasons: [
            `Quantity for "${orderItem.productTitle}" must be between 1 and ${eligibilityItem.eligibility.maxReturnableQuantity}.`,
          ],
        };
      }

      const lineTotal = Number(orderItem.price) * itemInput.quantity;
      returnItems.push({
        orderItem: { connect: { id: orderItem.id } },
        product: { connect: { id: orderItem.productId } },
        ...(orderItem.variantId
          ? { variant: { connect: { id: orderItem.variantId } } }
          : {}),
        productTitle: orderItem.productTitle,
        productSlug: orderItem.productSlug,
        productImage: orderItem.productImage ?? null,
        size: orderItem.size ?? null,
        requestedQuantity: itemInput.quantity,
        price: new Prisma.Decimal(orderItem.price),
        lineTotal: new Prisma.Decimal(lineTotal),
      });
    }

    if (returnItems.length === 0) {
      return {
        kind: 'not-eligible',
        reasons: ['At least one item must be selected for return.'],
      };
    }

    const returnNumber = `VEXO-RET-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;

    const existingReturn = order.returnRequests.find(
      (r) =>
        r.status !== 'REJECTED' &&
        r.status !== 'COMPLETED' &&
        r.status !== 'CANCELLED',
    );
    if (existingReturn) {
      return { kind: 'conflict' };
    }

    const returnRequest = await tx.returnRequest.create({
      data: {
        returnNumber,
        userId,
        orderId: input.orderId,
        status: 'REQUESTED' as ReturnStatus,
        returnReason: input.returnReason as ReturnRequest_returnReason,
        returnType: input.returnType as ReturnRequest_returnType,
        customerComments: input.customerComments ?? null,
        requestedAt: new Date(),
        items: {
          create: returnItems as Prisma.ReturnItemCreateInput[],
        },
        events: {
          create: {
            status: 'REQUESTED' as ReturnStatus,
            title: returnStatusLabel('REQUESTED'),
            source: 'CUSTOMER',
            actorId: userId,
            description: 'Return request submitted by customer.',
          },
        },
      },
      include: { items: true },
    });

    await writeAdminAudit(tx, {
      actorId: userId,
      action: 'return.requested',
      entityType: 'return',
      entityId: returnRequest.id,
      reason: input.returnReason,
    });

    return { kind: 'created', returnRequest };
  });
}

type ReturnRequest_returnReason = 'WRONG_SIZE' | 'WRONG_PRODUCT' | 'DAMAGED' | 'DEFECTIVE' | 'DIFFERS_FROM_DESCRIPTION' | 'QUALITY_ISSUE' | 'OTHER';
type ReturnRequest_returnType = 'REFUND' | 'EXCHANGE';

export type CancelReturnResult =
  | { kind: 'cancelled' }
  | { kind: 'not-found' }
  | { kind: 'not-eligible'; reason: string }
  | { kind: 'conflict' };

export async function cancelCustomerReturn({
  userId,
  returnId,
}: {
  userId: string;
  returnId: string;
}): Promise<CancelReturnResult> {
  return db.$transaction(async (tx) => {
    const rateLimit = await rateLimitActorAction(
      userId,
      'return-cancel',
      10,
      60_000,
    );
    if (rateLimit) {
      throw new Error('Too many requests; try again shortly.');
    }

    const returnRequest = await tx.returnRequest.findFirst({
      where: { id: returnId, userId },
      include: { items: true },
    });
    if (!returnRequest) return { kind: 'not-found' };

    if (!canCancelReturnStatus(returnRequest.status)) {
      return {
        kind: 'not-eligible',
        reason: `A return in the "${returnStatusLabel(
          returnRequest.status,
        )}" state cannot be cancelled.`,
      };
    }

    const claimed = await tx.returnRequest.updateMany({
      where: {
        id: returnRequest.id,
        userId,
        status: returnRequest.status,
      },
      data: {
        status: 'CANCELLED' as ReturnStatus,
        resolvedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return { kind: 'conflict' };

    await tx.returnStatusEvent.create({
      data: {
        returnRequestId: returnRequest.id,
        status: 'CANCELLED' as ReturnStatus,
        title: returnStatusLabel('CANCELLED'),
        source: 'CUSTOMER',
        actorId: userId,
        description: 'Return cancelled by customer.',
      },
    });

    await writeAdminAudit(tx, {
      actorId: userId,
      action: 'return.cancelled',
      entityType: 'return',
      entityId: returnRequest.id,
    });

    return { kind: 'cancelled' };
  });
}

function canCancelReturnStatus(status: ReturnStatus): boolean {
  return status === 'REQUESTED' || status === 'UNDER_REVIEW';
}

export async function getCustomerReturnRequest({
  userId,
  returnId,
}: {
  userId: string;
  returnId: string;
}) {
  return db.returnRequest.findFirst({
    where: { id: returnId, userId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          total: true,
          currency: true,
          payment: {
            select: { provider: true, method: true, status: true },
          },
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: { slug: true, category: true } },
          variant: { select: { size: true, sku: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      shipment: true,
      exchangeRequest: true,
      offlineRefund: true,
    },
  });
}

export async function getAdminReturnRequest(returnId: string) {
  return db.returnRequest.findUnique({
    where: { id: returnId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          total: true,
          currency: true,
          payment: {
            select: { provider: true, method: true, status: true, amount: true },
          },
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: { slug: true, category: true } },
          variant: { select: { size: true, sku: true, stock: true } },
          inspections: {
            orderBy: { createdAt: 'desc' },
            include: { inspector: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      shipment: true,
      exchangeRequest: true,
      offlineRefund: true,
    },
  });
}
