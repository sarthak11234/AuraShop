import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { cancelCustomerReturn } from '@/lib/return-service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { returnId } = await params;

  try {
    const result = await cancelCustomerReturn({ userId, returnId });

    if (result.kind === 'not-found') {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }
    if (result.kind === 'not-eligible') {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: 'Unable to cancel at this time' }, { status: 409 });
    }

    return NextResponse.json({ kind: 'cancelled' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Too many')) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    console.error('[POST /api/account/returns/[returnId]/cancel]', error);
    return NextResponse.json({ error: 'Failed to cancel return' }, { status: 500 });
  }
}
