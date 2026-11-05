import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { canAccessOrder } from '@/lib/order-access';
import { fetchRazorpayPayment } from '@/lib/payment';

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
    if (!isRecord(body) || typeof body.orderId !== 'string' || typeof body.paymentId !== 'string') {
      return NextResponse.json({ error: 'Order and payment IDs are required' }, { status: 400 });
    }

    const order = await db.order.findUnique({
      where: { id: body.orderId },
      include: { payment: true },
    });
    if (!order?.payment || order.payment.provider !== 'razorpay') {
      return NextResponse.json({ error: 'Razorpay order not found' }, { status: 404 });
    }

    const session = await auth();
    if (!canAccessOrder(order, session?.user?.id ?? null, request.headers.get('X-Checkout-Token'))) {
      return NextResponse.json({ error: 'Order access denied' }, { status: 403 });
    }
    if (!order.payment.providerOrderId) {
      return NextResponse.json({ error: 'Payment attempt was not started for this order' }, { status: 409 });
    }

    const providerPayment = await fetchRazorpayPayment(body.paymentId);
    if (
      providerPayment.status !== 'failed' ||
      providerPayment.order_id !== order.payment.providerOrderId
    ) {
      return NextResponse.json({ error: 'Razorpay has not confirmed this payment attempt failed' }, { status: 409 });
    }

    if (order.payment.status !== 'captured' && order.payment.status !== 'verified') {
      await db.$transaction(async (tx) => {
        const updated = await tx.payment.updateMany({
          where: {
            id: order.payment!.id,
            providerOrderId: providerPayment.order_id,
            status: { notIn: ['captured', 'verified'] },
          },
          data: { status: 'failed', failureReason: 'Payment was not completed' },
        });
        if (updated.count === 1) {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'failed' },
          });
        }
      });
    }

    return NextResponse.json({ success: true, status: 'failed', orderId: order.id });
  } catch (error) {
    console.error('[POST /api/payment/razorpay/fail]', error);
    return NextResponse.json(
      { error: 'Unable to confirm payment failure. Please wait before retrying.' },
      { status: 502 },
    );
  }
}
