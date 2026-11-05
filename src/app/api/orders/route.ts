import { NextResponse } from 'next/server';
import { OrderStatus, Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { canAccessOrder } from '@/lib/order-access';
import { db } from '@/lib/db';

const orderSelect = {
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
  createdAt: true,
  items: {
    select: {
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
      capturedAt: true,
    },
  },
} satisfies Prisma.OrderSelect;

type SafeOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

function serializeOrder(order: SafeOrder) {
  return {
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
      ? {
          ...order.payment,
          amount: Number(order.payment.amount),
        }
      : null,
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in to view your order history' }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const rawStatus = params.get('status');
    if (rawStatus && !Object.values(OrderStatus).includes(rawStatus as OrderStatus)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
    }

    const orders = await db.order.findMany({
      where: {
        userId,
        ...(rawStatus ? { status: rawStatus as OrderStatus } : {}),
      },
      select: orderSelect,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(orders.map(serializeOrder));
  } catch (error) {
    console.error('[GET /api/orders]', error);
    return NextResponse.json({ error: 'Failed to fetch order history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const orderId = new URL(request.url).searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const session = await auth();
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        ...orderSelect,
        userId: true,
        guestAccessTokenHash: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!canAccessOrder(order, session?.user?.id ?? null, request.headers.get('X-Checkout-Token'))) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 });
    }

    return NextResponse.json(serializeOrder(order));
  } catch (error) {
    console.error('[POST /api/orders lookup]', error);
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 });
  }
}
