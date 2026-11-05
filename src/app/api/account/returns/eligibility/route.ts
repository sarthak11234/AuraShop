import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { evaluateReturnEligibility } from '@/lib/return-policy';

export async function GET(request: Request) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId') || undefined;
  if (!orderId) {
    return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
  }

  try {
    const eligibility = await evaluateReturnEligibility({ orderId, userId });
    return NextResponse.json(eligibility);
  } catch (error) {
    console.error('[GET /api/account/returns/eligibility]', error);
    return NextResponse.json({ error: 'Failed to evaluate eligibility' }, { status: 500 });
  }
}
