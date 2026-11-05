import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { approveExchange } from '@/lib/return-exchange';
import { db } from '@/lib/db';
import {
  sendEmail,
  emailSubject,
  renderExchangeUpdateEmailHtml,
  renderExchangeUpdateEmailText,
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

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-exchange-approve', 30);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  const result = await approveExchange({
    actorId: actor.id,
    returnRequestId: returnId,
  });

  if (result.kind === 'not-found') {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }
  if (result.kind === 'not-eligible') {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  if (result.kind === 'conflict') {
    return NextResponse.json({ error: 'Concurrent modification' }, { status: 409 });
  }

  // Send exchange update email (fire-and-forget)
  void (async () => {
    try {
      const fullReturn = await db.returnRequest.findUnique({
        where: { id: returnId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: { select: { orderNumber: true } },
          exchangeRequest: {
            select: {
              replacementProductId: true,
              replacementQuantity: true,
              replacementVariantId: true,
            },
            include: {
              replacementVariant: { select: { size: true, sku: true } },
              replacementProduct: { select: { title: true } },
            },
          },
        },
      });
      if (!fullReturn?.user?.email) return;

      await sendEmail({
        to: fullReturn.user.email,
        subject: emailSubject(
          `Update on your VEXO exchange — ${fullReturn.returnNumber}`,
        ),
        html: renderExchangeUpdateEmailHtml({
          returnRequestId: fullReturn.returnNumber,
          orderNumber: fullReturn.order.orderNumber,
          customerName: fullReturn.user.name,
          replacementProduct: fullReturn.exchangeRequest?.replacementProduct?.title || null,
          replacementQuantity:
            fullReturn.exchangeRequest?.replacementQuantity ?? undefined,
          status: fullReturn.exchangeRequest?.status || 'PENDING',
          statusLabel: 'Your exchange has been approved',
          updatedAt: new Date(),
          appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        }),
        text: renderExchangeUpdateEmailText({
          returnRequestId: fullReturn.returnNumber,
          orderNumber: fullReturn.order.orderNumber,
          customerName: fullReturn.user.name,
          replacementProduct: fullReturn.exchangeRequest?.replacementProduct?.title || null,
          replacementQuantity:
            fullReturn.exchangeRequest?.replacementQuantity ?? undefined,
          status: fullReturn.exchangeRequest?.status || 'PENDING',
          statusLabel: 'Your exchange has been approved',
          updatedAt: new Date(),
          appUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        }),
      });
    } catch (error) {
      console.error('[sendExchangeUpdateEmail]', error);
    }
  })();

  return NextResponse.json({ status: 'EXCHANGE_PROCESSING' });
}
