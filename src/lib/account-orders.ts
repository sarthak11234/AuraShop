import { OrderStatus, Prisma } from '@prisma/client';
import { cache } from 'react';
import { getCancellationEligibility } from '@/lib/order-lifecycle';
import { db } from '@/lib/db';

export const CUSTOMER_ORDER_PAGE_SIZE = 10;
export const MAX_CUSTOMER_ORDER_PAGE_SIZE = 25;

export type CustomerOrderSort = 'newest' | 'oldest';

export const customerOrderListSelect = {
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
  createdAt: true,
  items: {
    select: {
      productTitle: true,
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
      method: true,
      status: true,
    },
  },
} satisfies Prisma.OrderSelect;

export type CustomerOrderListRow = Prisma.OrderGetPayload<{
  select: typeof customerOrderListSelect;
}>;

export const customerOrderDetailSelect = {
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
  cancellationReason: true,
  inventoryReservedAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      productId: true,
      productTitle: true,
      productSlug: true,
      productImage: true,
      variantId: true,
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
      providerOrderId: true,
      capturedAt: true,
      verifiedAt: true,
    },
  },
  trackingEvents: {
    orderBy: { createdAt: 'asc' as const },
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
} satisfies Prisma.OrderSelect;

export type CustomerOrderDetailRow = Prisma.OrderGetPayload<{
  select: typeof customerOrderDetailSelect;
}>;

export function isCustomerOrderStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}

export function parseCustomerOrderSort(value: string | null | undefined): CustomerOrderSort {
  return value === 'oldest' ? 'oldest' : 'newest';
}

export function parseCustomerOrderPage(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isInteger(parsed) ? Math.min(100_000, Math.max(1, parsed)) : 1;
}

export async function getCustomerOrderList({
  userId,
  status,
  sort = 'newest',
  page = 1,
  pageSize = CUSTOMER_ORDER_PAGE_SIZE,
}: {
  userId: string;
  status?: OrderStatus;
  sort?: CustomerOrderSort;
  page?: number;
  pageSize?: number;
}) {
  const safePageSize = Math.min(
    MAX_CUSTOMER_ORDER_PAGE_SIZE,
    Math.max(1, Math.trunc(pageSize)),
  );
  const where: Prisma.OrderWhereInput = {
    userId,
    ...(status ? { status } : {}),
  };
  const orderBy = { createdAt: sort === 'oldest' ? ('asc' as const) : ('desc' as const) };

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      select: customerOrderListSelect,
      orderBy,
      skip: (page - 1) * safePageSize,
      take: safePageSize,
    }),
    db.order.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);
  if (totalPages > 0 && page > totalPages) {
    const clamped = await db.order.findMany({
      where,
      select: customerOrderListSelect,
      orderBy,
      skip: (totalPages - 1) * safePageSize,
      take: safePageSize,
    });
    return {
      orders: clamped,
      total,
      page: totalPages,
      pageSize: safePageSize,
      totalPages,
    };
  }

  return {
    orders: rows,
    total,
    page: totalPages === 0 ? 1 : page,
    pageSize: safePageSize,
    totalPages,
  };
}

/** Order ownership is part of the query, never trusted from the client. */
export const getCustomerOrderDetail = cache(async (userId: string, orderId: string) => {
  return db.order.findFirst({
    where: { id: orderId, userId },
    select: customerOrderDetailSelect,
  });
});

export function serializeCustomerOrderList(order: CustomerOrderListRow) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => ({
      productTitle: item.productTitle,
      productImage: item.productImage,
      size: item.size,
      quantity: item.quantity,
      price: Number(item.price),
      lineTotal: Number(item.lineTotal),
    })),
    payment: order.payment
      ? {
          provider: order.payment.provider,
          method: order.payment.method,
          status: order.payment.status,
        }
      : null,
  };
}

export function serializeCustomerOrderDetail(order: CustomerOrderDetailRow) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shipping: Number(order.shipping),
    tax: Number(order.tax),
    total: Number(order.total),
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancellationReason: order.cancellationReason,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productTitle: item.productTitle,
      productSlug: item.productSlug,
      productImage: item.productImage,
      variantId: item.variantId,
      size: item.size,
      quantity: item.quantity,
      price: Number(item.price),
      lineTotal: Number(item.lineTotal),
    })),
    payment: order.payment
      ? {
          provider: order.payment.provider,
          status: order.payment.status,
          amount: Number(order.payment.amount),
          currency: order.payment.currency,
          method: order.payment.method,
          capturedAt: order.payment.capturedAt?.toISOString() ?? null,
          verifiedAt: order.payment.verifiedAt?.toISOString() ?? null,
        }
      : null,
    trackingEvents: order.trackingEvents.map((event) => ({
      id: event.id,
      status: event.status,
      title: event.title,
      description: event.description,
      location: event.location,
      source: event.source,
      carrier: event.carrier,
      trackingNumber: event.trackingNumber,
      createdAt: event.createdAt.toISOString(),
    })),
    cancellation: getCancellationEligibility({
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
    }),
  };
}

export type OrderAddressSnapshot = {
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Parses the immutable JSON snapshot written at checkout. Missing required
 * fields make the snapshot unavailable rather than falling back to live data.
 */
export function parseOrderAddressSnapshot(value: unknown): OrderAddressSnapshot | null {
  if (!isRecord(value)) return null;
  const firstName = text(value.firstName);
  const lastName = text(value.lastName);
  const phone = text(value.phone);
  const addressLine1 = text(value.addressLine1);
  const city = text(value.city);
  const postalCode = text(value.postalCode);
  const country = text(value.country);
  if (!firstName || !lastName || !phone || !addressLine1 || !city || !postalCode || !country) {
    return null;
  }

  return {
    firstName,
    lastName,
    company: text(value.company),
    phone,
    addressLine1,
    addressLine2: text(value.addressLine2),
    city,
    state: text(value.state),
    postalCode,
    country,
  };
}
