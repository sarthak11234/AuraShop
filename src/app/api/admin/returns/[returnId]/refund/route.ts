import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { initiateRefund } from '@/lib/return-refund';
import { db } from '@/lib/db';
import {
  sendEmail,
  emailSubject,
  renderRefundUpdateEmailHtml,
  renderRefundUpdateEmailText,
} from '@/lib/email';

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? body : {};
  }
  const formData = await request.formData();
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    result[key] = value;
  }
  return result;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-refund', 10);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  const body = await readBody(_request);
  const reason = readString(body.reason) || null;

  const result = await initiateRefund({
    actorId: actor.id,
    returnRequestId: returnId,
    reason,
  });

  if (result.kind === 'not-found') {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }
  if (result.kind === 'not-eligible') {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  if (result.kind === 'already-refunded') {
    return NextResponse.json({ error: 'Refund already processed for this return' }, { status: 409 });
  }
  if (result.kind === 'gateway-unavailable') {
    return NextResponse.json({ error: result.reason }, { status: 503 });
  }
  if (result.kind === 'gateway-error') {
    return NextResponse.json({ error: result.reason }, { status: 502 });
  }
  if (result.kind === 'conflict') {
    return NextResponse.json({ error: 'Concurrent modification' }, { status: 409 });
  }

  return NextResponse.json({
    status: 'REFUND_PENDING',
    refundId: result.refundId,
    providerRefundId: result.providerRefundId,
  });

  // Send refund update email (fire-and-forget)
  void (async () => {
    try {
      const fullReturn = await db.returnRequest.findUnique({
        where: { id: returnId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: { select: { orderNumber: true, currency: true } },
        },
      });
      if (!fullReturn?.user?.email) return;

      await sendEmail({
        to: fullReturn.user.email,
        subject: emailSubject(
          `Update on your VEXO refund — ${fullReturn.returnNumber}`,
        ),
        html: renderRefundUpdateEmailHtml({
          returnRequestId: fullReturn.returnNumber,
          orderNumber: fullReturn.order.orderNumber,
          customerName: fullReturn.user.name,
          amount: Number(fullReturn.refundAmount || 0),
          currency: fullReturn.order.currency,
          method: 'razorpay',
          status: 'REFUND_PENDING',
          statusLabel: 'Your refund is being processed',
          updatedAt: new Date(),
          appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        }),
        text: renderRefundUpdateEmailText({
          returnRequestId: fullReturn.returnNumber,
          orderNumber: fullReturn.order.orderNumber,
          customerName: fullReturn.user.name,
          amount: Number(fullReturn.refundAmount || 0),
          currency: fullReturn.order.currency,
          method: 'razorpay',
          status: 'REFUND_PENDING',
          statusLabel: 'Your refund is being processed',
          updatedAt: new Date(),
          appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        }),
      });
    } catch (error) {
      console.error('[sendRefundUpdateEmail]', error);
    }
  })();
}
