import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/auth';
import { canAccessOrder } from '@/lib/order-access';
import { createRazorpayOrder, isRazorpayConfigured } from '@/lib/payment';

export async function GET() {
  return NextResponse.json({ available: isRazorpayConfigured() });
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { orderId } = (body || {}) as { orderId?: string };

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid orderId parameter' },
        { status: 400 }
      );
    }

    const session = await auth();
    const checkoutToken = request.headers.get('X-Checkout-Token');
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!canAccessOrder(order, session?.user?.id ?? null, checkoutToken)) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 });
    }

    if (order.payment?.provider !== 'razorpay') {
      return NextResponse.json({ error: 'Order is not configured for Razorpay' }, { status: 400 });
    }

    if (order.paymentStatus === 'paid' || order.payment?.status === 'captured') {
      return NextResponse.json({ error: 'Order has already been paid' }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Online payment is unavailable because the Razorpay gateway is not configured. Choose Cash on Delivery.' },
        { status: 503 }
      );
    }

    if (order.payment.providerOrderId && order.payment.status === 'pending') {
      return NextResponse.json({
        status: 'created',
        razorpay_order_id: order.payment.providerOrderId,
        amount: Math.round(Number(order.total) * 100),
        currency: order.currency,
        key_id: keyId,
        order_id: order.id,
        order_number: order.orderNumber,
      });
    }

    const amountInCents = Math.round(Number(order.total) * 100);
    const razorpayOrder = await createRazorpayOrder({
      amountInCents,
      currency: order.currency || 'USD',
      receipt: order.orderNumber,
    });

    if (
      razorpayOrder.amount !== amountInCents ||
      razorpayOrder.currency !== order.currency
    ) {
      throw new Error('Razorpay returned an order with a mismatched amount or currency.');
    }
    await db.$transaction([
      db.payment.update({
        where: { id: order.payment.id },
        data: {
          providerOrderId: razorpayOrder.id,
          amount: order.total,
          currency: razorpayOrder.currency,
          gatewayResponse: razorpayOrder,
          status: 'pending',
          failureReason: null,
        },
      }),
      db.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'pending' },
      }),
    ]);

    return NextResponse.json({
      status: 'created',
      razorpay_order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: keyId,
      order_id: order.id,
      order_number: order.orderNumber,
    });
  } catch (error) {
    console.error('[POST /api/payment/razorpay]', error);
    return NextResponse.json(
      { error: 'Unable to start online payment right now. Your order has not been confirmed.' },
      { status: 502 }
    );
  }
}
