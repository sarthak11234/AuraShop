import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import {
  getCustomerOrderDetail,
  parseOrderAddressSnapshot,
  serializeCustomerOrderDetail,
} from '@/lib/account-orders';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { orderId } = await params;
  if (!orderId || orderId.length > 64) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  try {
    // Ownership is part of the database query — a client-supplied order id can
    // never prove access to another customer's order.
    const order = await getCustomerOrderDetail(userId, orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        ...serializeCustomerOrderDetail(order),
        shippingAddressSnapshot: parseOrderAddressSnapshot(order.shippingAddress),
        billingAddressSnapshot: parseOrderAddressSnapshot(order.billingAddress),
      },
    });
  } catch (error) {
    console.error('[GET /api/account/orders/[orderId]]', error);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
}
