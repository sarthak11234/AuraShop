import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { inspectReturnItems } from '@/lib/return-inspection';
import type { ItemCondition } from '@prisma/client';

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

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-inspect', 30);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  const body = await readBody(_request);
  let rawItems = body.items;
  if (typeof rawItems === 'string') {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      return NextResponse.json({ error: 'Invalid items JSON' }, { status: 400 });
    }
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: 'At least one inspection item is required' }, { status: 400 });
  }

  const items: Array<{
    returnItemId: string;
    receivedQuantity: number;
    inspectedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    condition: ItemCondition;
    restockable: boolean;
    inspectionNotes?: string | null;
  }> = [];

  for (const raw of rawItems) {
    if (typeof raw !== 'object' || raw === null) {
      return NextResponse.json({ error: 'Invalid inspection item' }, { status: 400 });
    }
    const receivedQuantity = readNumber((raw as Record<string, unknown>).receivedQuantity);
    const inspectedQuantity = readNumber((raw as Record<string, unknown>).inspectedQuantity);
    const acceptedQuantity = readNumber((raw as Record<string, unknown>).acceptedQuantity);
    const rejectedQuantity = readNumber((raw as Record<string, unknown>).rejectedQuantity);
    const condition = readString((raw as Record<string, unknown>).condition) as ItemCondition;
    const restockable = Boolean((raw as Record<string, unknown>).restockable);
    const inspectionNotes = readString((raw as Record<string, unknown>).inspectionNotes) || null;

    if (
      receivedQuantity === null ||
      inspectedQuantity === null ||
      acceptedQuantity === null ||
      rejectedQuantity === null ||
      !condition
    ) {
      return NextResponse.json({ error: 'Invalid inspection item fields' }, { status: 400 });
    }

    items.push({
      returnItemId: readString((raw as Record<string, unknown>).returnItemId),
      receivedQuantity,
      inspectedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      condition,
      restockable,
      inspectionNotes,
    });
  }

  const result = await inspectReturnItems({
    actorId: actor.id,
    returnRequestId: returnId,
    items,
  });

  if (result.kind === 'not-found') {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }
  if (result.kind === 'not-eligible') {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  if (result.kind === 'duplicate') {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  if (result.kind === 'conflict') {
    return NextResponse.json({ error: 'Concurrent modification' }, { status: 409 });
  }

  return NextResponse.json({ status: 'INSPECTED', restockableQuantity: result.restockableQuantity });
}
