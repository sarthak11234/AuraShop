import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { canAccessOrder } from '@/lib/order-access';
import {
  captureRazorpayPayment,
  fetchRazorpayPayment,
  verifyRazorpayPaymentSignature,
} from '@/lib/payment';
import { InventorySettlementError, settleCapturedRazorpayPayment } from '@/lib/razorpay-settlement';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const razorpayOrderId = body.razorpay_order_id;
    const razorpayPaymentId = body.razorpay_payment_id;
    const razorpaySignature = body.razorpay_signature;
    const orderId = body.orderId;
    if (
      typeof razorpayOrderId !== 'string' ||
      typeof razorpayPaymentId !== 'string' ||
      typeof razorpaySignature !== 'string' ||
      typeof orderId !== 'string' ||
      !orderId
    ) {
      return NextResponse.json(
        { error: 'Missing or malformed payment verification parameters' },
        { status: 400 },
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Online payment is unavailable because the Razorpay gateway is not configured.' },
        { status: 503 },
      );
    }
    if (!verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret,
    })) {
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
    }

    const session = await auth();
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });
    if (!order?.payment || order.payment.provider !== 'razorpay') {
      return NextResponse.json({ error: 'No Razorpay order found' }, { status: 404 });
    }
    if (!canAccessOrder(order, session?.user?.id ?? null, request.headers.get('X-Checkout-Token'))) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 });
    }
    if (order.payment.providerOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: 'Payment does not correspond to this order' }, { status: 400 });
    }
    if (
      order.payment.providerPaymentId &&
      order.payment.providerPaymentId !== razorpayPaymentId
    ) {
      return NextResponse.json({ error: 'A different payment is already associated with this order' }, { status: 409 });
    }
    if (order.payment.status === 'captured' || order.payment.status === 'verified') {
      return NextResponse.json({
        success: true,
        status: 'verified',
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }

    let providerPayment = await fetchRazorpayPayment(razorpayPaymentId);
    const expectedAmount = Math.round(Number(order.total) * 100);
    if (
      providerPayment.order_id !== razorpayOrderId ||
      providerPayment.amount !== expectedAmount ||
      providerPayment.currency !== order.currency
    ) {
      return NextResponse.json(
        { error: 'Razorpay payment amount or order does not match this order.' },
        { status: 409 },
      );
    }
    if (providerPayment.status === 'authorized') {
      await captureRazorpayPayment({
        paymentId: providerPayment.id,
        amount: expectedAmount,
        currency: order.currency,
      });
      providerPayment = await fetchRazorpayPayment(razorpayPaymentId);
    }
    if (providerPayment.status !== 'captured') {
      return NextResponse.json(
        { error: 'Razorpay has not confirmed a captured payment matching this order.' },
        { status: 409 },
      );
    }

    const result = await settleCapturedRazorpayPayment({
      providerOrderId: razorpayOrderId,
      providerPaymentId: razorpayPaymentId,
      amount: providerPayment.amount,
      currency: providerPayment.currency,
      signature: razorpaySignature,
    });
    if (result === 'not-found') {
      return NextResponse.json({ error: 'No order found matching the payment' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: 'verified',
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    if (error instanceof InventorySettlementError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[POST /api/payment/razorpay/verify]', error);
    return NextResponse.json(
      { error: 'Unable to verify payment right now. Do not retry payment; contact support if you were charged.' },
      { status: 502 },
    );
  }
}
