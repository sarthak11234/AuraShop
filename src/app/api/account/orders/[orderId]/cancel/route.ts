import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { cancelCustomerOrder } from '@/lib/order-cancellation';
import { rateLimitActorAction } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ orderId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitActorAction(userId, 'account-order-cancel', 5);
  if (rateLimitResponse) return rateLimitResponse;

  const { orderId } = await params;
  if (!orderId || orderId.length > 64) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is allowed; the cancellation reason falls back to a safe
    // customer-facing default.
  }

  const rawReason = isRecord(body) && typeof body.reason === 'string' ? body.reason.trim() : '';
  if (rawReason.length > 500) {
    return NextResponse.json({ error: 'Cancellation reason must be 500 characters or fewer' }, { status: 400 });
  }
  const reason = rawReason || 'Cancelled by customer';

  try {
    const result = await cancelCustomerOrder({ userId, orderId, reason });

    if (result.kind === 'not-found') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (result.kind === 'already-cancelled') {
      return NextResponse.json(
        {
          error: 'This order has already been cancelled.',
          code: 'ALREADY_CANCELLED',
        },
        { status: 409 },
      );
    }
    if (result.kind === 'not-eligible') {
      return NextResponse.json(
        { error: result.reason, code: result.code },
        { status: 409 },
      );
    }
    if (result.kind === 'inventory-unavailable') {
      return NextResponse.json(
        { error: result.reason, code: 'INVENTORY_UNAVAILABLE' },
        { status: 409 },
      );
    }
    if (result.kind === 'conflict') {
      return NextResponse.json(
        {
          error: 'Order changed while cancelling. Refresh and review the latest status.',
          code: 'CONFLICT',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      status: 'CANCELLED',
      cancelledAt: result.cancelledAt.toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/account/orders/[orderId]/cancel]', error);
    return NextResponse.json(
      { error: 'Failed to cancel order. Contact support if the problem persists.' },
      { status: 500 },
    );
  }
}
