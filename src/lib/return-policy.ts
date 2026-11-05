import type { OrderStatus } from '@prisma/client';
import { db } from '@/lib/db';

/** Centralised, single source of truth for the VEXO return policy. */
export interface ReturnPolicyConfig {
  /** Days after delivery within which a return can be requested. */
  returnWindowDays: number;
  /** Order statuses that permit a return request. */
  eligibleStatuses: OrderStatus[];
  /** Product categories that are never returnable. */
  nonReturnableCategories: string[];
  /** Whether exchanges are allowed. */
  exchangeAllowed: boolean;
  /** Whether refunds are allowed. */
  refundAllowed: boolean;
  /** Whether the customer bears return shipping. */
  customerPaysReturnShipping: boolean;
}

/** Production defaults. Overridable via environment variables. */
function readEnvConfig(): ReturnPolicyConfig {
  return {
    returnWindowDays: Number.parseInt(
      process.env.RETURN_WINDOW_DAYS ?? '30',
      10,
    ),
    eligibleStatuses: ['DELIVERED'] as OrderStatus[],
    nonReturnableCategories: (
      process.env.NON_RETURNABLE_CATEGORIES ?? ''
    )
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
    exchangeAllowed:
      process.env.RETURN_EXCHANGE_ALLOWED !== 'false',
    refundAllowed: process.env.RETURN_REFUND_ALLOWED !== 'false',
    customerPaysReturnShipping:
      process.env.RETURN_CUSTOMER_PAYS_SHIPPING === 'true',
  };
}

const policyConfig: ReturnPolicyConfig = readEnvConfig();

/** Evaluation outcome for a single return-line item. */
export type ReturnItemEligibility = {
  eligible: boolean;
  reasons: string[];
  maxReturnableQuantity: number;
};

/** Evaluation outcome for an entire order. */
export type ReturnEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  policy: ReturnPolicyConfig;
  items: Array<{
    orderItemId: number;
    productId: string;
    productTitle: string;
    variantId: string | null;
    size: string | null;
    purchasedQuantity: number;
    alreadyReturnedQuantity: number;
    eligibility: ReturnItemEligibility;
  }>;
};

/**
 * Evaluates whether an order (and each of its items) can be returned.
 * Centralised so every customer/admin API route enforces the same policy.
 */
export async function evaluateReturnEligibility({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): Promise<ReturnEligibilityResult> {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
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

  if (!order) {
    return {
      eligible: false,
      reasons: ['Order not found or not owned by this account.'],
      policy: policyConfig,
      items: [],
    };
  }

  const reasons: string[] = [];

  // Only delivered orders are normally eligible for a standard return.
  if (!policyConfig.eligibleStatuses.includes(order.status as OrderStatus)) {
    reasons.push(
      `Returns are not available for orders in the "${order.status}" status. Only delivered orders can be returned.`,
    );
  }

  // The return window is measured from delivery (shippedAt is used as a
  // proxy when an explicit delivery timestamp is not tracked).
  const deliveryDate = order.shippedAt ?? order.createdAt;
  const windowExpiry = new Date(
    deliveryDate.getTime() + policyConfig.returnWindowDays * 24 * 60 * 60 * 1000,
  );
  if (new Date() > windowExpiry) {
    reasons.push(
      `The return window of ${policyConfig.returnWindowDays} days has expired.`,
    );
  }

  // Duplicate/in-progress return requests block new requests for this order.
  const activeReturn = order.returnRequests.find(
    (r) => r.status !== 'REJECTED' && r.status !== 'COMPLETED' && r.status !== 'CANCELLED',
  );
  if (activeReturn) {
    reasons.push(
      'An active return request already exists for this order. Only one return per order is allowed.',
    );
  }

  const cancelled = order.status === 'CANCELLED';
  if (cancelled) {
    reasons.push('Cancelled orders cannot be returned.');
  }

  const itemResults = await Promise.all(
    order.items.map(async (item) => {
      const alreadyReturned = item.returnItems.reduce(
        (sum, ri) => sum + (ri.approvedQuantity ?? 0),
        0,
      );
      const maxReturnable = Math.max(0, item.quantity - alreadyReturned);

      const itemReasons: string[] = [];
      let itemEligible = true;

      if (!maxReturnable) {
        itemEligible = false;
        itemReasons.push('No returnable quantity remains for this item.');
      }
      if (
        policyConfig.nonReturnableCategories.includes(item.product.category)
      ) {
        itemEligible = false;
        itemReasons.push('This product category is not returnable.');
      }

      return {
        orderItemId: item.id,
        productId: item.productId,
        productTitle: item.productTitle,
        variantId: item.variantId ?? null,
        size: item.size ?? null,
        purchasedQuantity: item.quantity,
        alreadyReturnedQuantity: alreadyReturned,
        eligibility: {
          eligible: itemEligible && maxReturnable > 0,
          reasons: itemReasons,
          maxReturnableQuantity: maxReturnable,
        },
      };
    }),
  );

  const eligible =
    reasons.length === 0 &&
    itemResults.every((i) => i.eligibility.eligible);

  return {
    eligible,
    reasons,
    policy: policyConfig,
    items: itemResults,
  };
}

/** Public configuration for read-only policy inspection (e.g. UI). */
export function getReturnPolicy(): ReturnPolicyConfig {
  return policyConfig;
}
