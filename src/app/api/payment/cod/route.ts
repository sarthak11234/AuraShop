import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { canAccessOrder } from '@/lib/order-access';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const orderId =
      typeof body === 'object' && body !== null && 'orderId' in body
        ? body.orderId
        : undefined;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid orderId parameter' },
        { status: 400 }
      );
    }

    const session = await auth();
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!canAccessOrder(order, session?.user?.id ?? null, request.headers.get('X-Checkout-Token'))) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 });
    }

    if (order.payment?.provider !== 'cod' || order.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: 'Order is not configured for confirmed Cash on Delivery' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'cod_confirmed',
      message: 'Cash on Delivery order confirmed. Payment will be collected upon delivery.',
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      currency: order.currency,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    console.error('[POST /api/payment/cod]', error);
    return NextResponse.json(
      { error: 'Failed to process COD confirmation' },
      { status: 500 }
    );
  }
}
