import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { receiveReturnShipment } from '@/lib/return-inspection';

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

function readNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-receive', 30);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  const body = await readBody(_request);
  const receivedQuantity = readNumber(body.receivedQuantity);
  if (receivedQuantity === null || receivedQuantity < 0) {
    return NextResponse.json({ error: 'Valid received quantity is required' }, { status: 400 });
  }

  const result = await receiveReturnShipment({
    actorId: actor.id,
    returnRequestId: returnId,
    receivedQuantity,
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

  return NextResponse.json({ status: 'RETURN_RECEIVED' });
}
