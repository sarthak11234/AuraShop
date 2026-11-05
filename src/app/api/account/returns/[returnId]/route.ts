import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { getCustomerReturnRequest } from '@/lib/return-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { returnId } = await params;

  try {
    const returnRequest = await getCustomerReturnRequest({ userId, returnId });
    if (!returnRequest) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }
    return NextResponse.json({ returnRequest });
  } catch (error) {
    console.error('[GET /api/account/returns/[returnId]]', error);
    return NextResponse.json({ error: 'Failed to load return' }, { status: 500 });
  }
}
