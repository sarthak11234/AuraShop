import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { getCustomerOrderDetail } from '@/lib/account-orders';
import { buildTrackingTimeline } from '@/lib/order-lifecycle';
import { getShippingProvider } from '@/lib/shipping';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { orderId } = await params;
  if (!orderId || orderId.length > 64) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  try {
    const order = await getCustomerOrderDetail(userId, orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const timeline = buildTrackingTimeline({
      createdAt: order.createdAt,
      orderNumber: order.orderNumber,
      events: order.trackingEvents,
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      provider: getShippingProvider(),
      timeline,
    });
  } catch (error) {
    console.error('[GET /api/account/orders/[orderId]/tracking]', error);
    return NextResponse.json({ error: 'Failed to load tracking' }, { status: 500 });
  }
}
