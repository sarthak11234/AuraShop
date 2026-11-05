import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRazorpayWebhookSignature } from '@/lib/payment';
import { settleCapturedRazorpayPayment } from '@/lib/razorpay-settlement';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!signature) {
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }
    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret is not configured on this server' }, { status: 503 });
    }

    const rawBody = await request.text();
    if (!verifyRazorpayWebhookSignature({ rawBody, signature, secret })) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed webhook payload JSON' }, { status: 400 });
    }
    if (!isRecord(event) || typeof event.event !== 'string' || !isRecord(event.payload)) {
      return NextResponse.json({ error: 'Invalid webhook event payload' }, { status: 400 });
    }

    const paymentPayload = isRecord(event.payload.payment) && isRecord(event.payload.payment.entity)
      ? event.payload.payment.entity
      : null;

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      if (
        !paymentPayload ||
        typeof paymentPayload.id !== 'string' ||
        typeof paymentPayload.order_id !== 'string' ||
        typeof paymentPayload.amount !== 'number' ||
        typeof paymentPayload.currency !== 'string' ||
        paymentPayload.status !== 'captured'
      ) {
        return NextResponse.json({ error: 'Webhook does not contain a captured payment' }, { status: 400 });
      }

      await settleCapturedRazorpayPayment({
        providerOrderId: paymentPayload.order_id,
        providerPaymentId: paymentPayload.id,
        amount: paymentPayload.amount,
        currency: paymentPayload.currency,
      });
    } else if (event.event === 'payment.failed') {
      if (!paymentPayload || typeof paymentPayload.order_id !== 'string') {
        return NextResponse.json({ error: 'Webhook does not contain a payment order ID' }, { status: 400 });
      }

      const payment = await db.payment.findFirst({
        where: { provider: 'razorpay', providerOrderId: paymentPayload.order_id },
        select: { id: true, orderId: true, status: true },
      });
      if (payment && payment.status !== 'captured' && payment.status !== 'verified') {
        await db.$transaction(async (tx) => {
          const updated = await tx.payment.updateMany({
            where: { id: payment.id, status: { notIn: ['captured', 'verified'] } },
            data: {
              status: 'failed',
              failureReason: typeof paymentPayload.error_description === 'string'
                ? paymentPayload.error_description.slice(0, 500)
                : 'Payment failed',
            },
          });
          if (updated.count === 1) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { paymentStatus: 'failed' },
            });
          }
        });
      }
    } else if (event.event === 'refund.processed') {
      const refundPayload = isRecord(event.payload.refund) && isRecord(event.payload.refund.entity)
        ? event.payload.refund.entity
        : null;
      if (
        refundPayload &&
        typeof refundPayload.id === 'string' &&
        typeof refundPayload.payment_id === 'string' &&
        typeof refundPayload.amount === 'number' &&
        refundPayload.status === 'processed'
      ) {
        const refund = await db.refund.findUnique({
          where: { providerRefundId: refundPayload.id },
          include: { payment: { select: { providerPaymentId: true } } },
        });
        if (
          refund &&
          refund.payment.providerPaymentId === refundPayload.payment_id &&
          Math.round(Number(refund.amount) * 100) === refundPayload.amount
        ) {
          await db.refund.update({
            where: { id: refund.id },
            data: { status: 'completed' },
          });
        }
      }
    }

    return NextResponse.json({ received: true, status: 'processed' });
  } catch (error) {
    console.error('[POST /api/payment/razorpay/webhook]', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
