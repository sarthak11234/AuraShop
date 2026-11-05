import type { OrderStatus } from '@prisma/client';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED_DELIVERY: 'Delivery failed',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const TRACKING_EVENT_TITLES: Record<OrderStatus, string> = {
  PENDING: 'Order placed',
  CONFIRMED: 'Order confirmed',
  PROCESSING: 'Preparing your order',
  PACKED: 'Order packed',
  SHIPPED: 'Order shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED_DELIVERY: 'Delivery attempt failed',
  CANCELLED: 'Order cancelled',
  RETURNED: 'Order returned',
};

/** The customer-facing happy-path fulfilment sequence. */
export const TRACKING_LIFECYCLE: ReadonlyArray<{
  status: OrderStatus;
  label: string;
}> = [
  { status: 'PENDING', label: 'Placed' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'PACKED', label: 'Packed' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
];

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'FAILED_DELIVERY',
];

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
}

export function trackingEventTitle(status: OrderStatus): string {
  return TRACKING_EVENT_TITLES[status] ?? orderStatusLabel(status);
}

export type CancellationEligibilityInput = {
  status: OrderStatus;
  cancelledAt: Date | string | null;
  paymentStatus: string;
  inventoryReservedAt: Date | string | null;
  payment: {
    provider: string;
    status: string;
    providerOrderId: string | null;
  } | null;
};

export type CancellationEligibility = {
  eligible: boolean;
  alreadyCancelled: boolean;
  code:
    | 'ELIGIBLE'
    | 'ALREADY_CANCELLED'
    | 'NOT_CANCELLABLE'
    | 'PAYMENT_STATE_UNAVAILABLE'
    | 'PAID_ONLINE'
    | 'PAYMENT_IN_PROGRESS'
    | 'INVENTORY_STATE_UNAVAILABLE';
  reason: string;
};

/**
 * Customer cancellation is deliberately conservative. It is only offered
 * before shipment, never for collected/digital payments (a real provider
 * refund cannot be guaranteed from the storefront), and only for COD orders
 * whose inventory reservation is known. This prevents fake refunds and double
 * stock restoration.
 */
export function getCancellationEligibility(
  input: CancellationEligibilityInput,
): CancellationEligibility {
  if (input.status === 'CANCELLED' || input.cancelledAt) {
    return {
      eligible: false,
      alreadyCancelled: true,
      code: 'ALREADY_CANCELLED',
      reason: 'This order has already been cancelled.',
    };
  }

  if (!CANCELLABLE_ORDER_STATUSES.includes(input.status)) {
    return {
      eligible: false,
      alreadyCancelled: false,
      code: 'NOT_CANCELLABLE',
      reason:
        'This order can no longer be cancelled because fulfilment has progressed beyond the packing stage.',
    };
  }

  const payment = input.payment;
  if (!payment) {
    return {
      eligible: false,
      alreadyCancelled: false,
      code: 'PAYMENT_STATE_UNAVAILABLE',
      reason: 'The payment state for this order is unavailable, so cancellation cannot be processed safely.',
    };
  }

  const settledStatuses = new Set(['captured', 'verified', 'refunded', 'partially_refunded', 'paid']);
  if (input.paymentStatus === 'paid' || settledStatuses.has(payment.status)) {
    return {
      eligible: false,
      alreadyCancelled: false,
      code: 'PAID_ONLINE',
      reason:
        'Payment has already been collected. Cancellation requires a verified refund, which must be handled by support.',
    };
  }

  if (payment.provider === 'razorpay' && payment.providerOrderId) {
    return {
      eligible: false,
      alreadyCancelled: false,
      code: 'PAYMENT_IN_PROGRESS',
      reason:
        'An online payment attempt is already associated with this order. Contact support so it can be closed safely.',
    };
  }

  if (payment.provider === 'cod') {
    if (!input.inventoryReservedAt) {
      return {
        eligible: false,
        alreadyCancelled: false,
        code: 'INVENTORY_STATE_UNAVAILABLE',
        reason:
          'The inventory reservation for this order cannot be confirmed. Contact support to cancel without risking stock integrity.',
      };
    }
    return {
      eligible: true,
      alreadyCancelled: false,
      code: 'ELIGIBLE',
      reason: 'This order can be cancelled and the reserved stock will be returned to the catalogue.',
    };
  }

  if (payment.provider === 'razorpay') {
    return {
      eligible: true,
      alreadyCancelled: false,
      code: 'ELIGIBLE',
      reason: 'This unpaid online order can be cancelled. No payment has been collected.',
    };
  }

  return {
    eligible: false,
    alreadyCancelled: false,
    code: 'PAYMENT_STATE_UNAVAILABLE',
    reason: 'This payment method cannot be cancelled safely from the account.',
  };
}

export type TrackingEventLike = {
  id: number;
  status: OrderStatus;
  title: string;
  description: string | null;
  location: string | null;
  source: string;
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: Date | string;
};

export type TrackingTimelineEntry = {
  key: string;
  status: OrderStatus | 'ORDER_PLACED';
  title: string;
  description: string | null;
  location: string | null;
  source: string;
  carrier: string | null;
  trackingNumber: string | null;
  occurredAt: string;
  derived: boolean;
};

/**
 * Builds the customer timeline strictly from the persisted order creation fact
 * and persisted tracking events. It never synthesises shipment events.
 */
export function buildTrackingTimeline({
  createdAt,
  orderNumber,
  events,
}: {
  createdAt: Date | string;
  orderNumber: string;
  events: TrackingEventLike[];
}): TrackingTimelineEntry[] {
  const sorted = [...events].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime || a.id - b.id;
  });

  const entries: TrackingTimelineEntry[] = [];
  const hasPendingEvent = sorted.some((event) => event.status === 'PENDING');

  if (!hasPendingEvent) {
    entries.push({
      key: 'order-placed',
      status: 'ORDER_PLACED',
      title: 'Order placed',
      description: `Order ${orderNumber} was created.`,
      location: null,
      source: 'ORDER',
      carrier: null,
      trackingNumber: null,
      occurredAt: new Date(createdAt).toISOString(),
      derived: true,
    });
  }

  for (const event of sorted) {
    entries.push({
      key: `event-${event.id}`,
      status: event.status,
      title: event.title || trackingEventTitle(event.status),
      description: event.description,
      location: event.location,
      source: event.source,
      carrier: event.carrier,
      trackingNumber: event.trackingNumber,
      occurredAt: new Date(event.createdAt).toISOString(),
      derived: false,
    });
  }

  return entries;
}
