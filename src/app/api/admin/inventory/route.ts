import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { db } from '@/lib/db';

const maximumQuantity = 1_000_000;

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const query = params.get('q')?.trim().slice(0, 100);

  try {
    const where = query
      ? {
          product: {
            OR: [
              { title: { contains: query, mode: 'insensitive' as const } },
              { slug: { contains: query, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};
    const [variants, total] = await Promise.all([
      db.productVariant.findMany({
        where,
        orderBy: [{ product: { title: 'asc' } }, { size: 'asc' }],
        skip: (page - 1) * 25,
        take: 25,
        select: {
          id: true,
          size: true,
          sku: true,
          stock: true,
          updatedAt: true,
          product: { select: { id: true, title: true, slug: true } },
          adjustments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              previousQuantity: true,
              newQuantity: true,
              difference: true,
              reason: true,
              createdAt: true,
              actor: { select: { name: true, email: true } },
            },
          },
        },
      }),
      db.productVariant.count({ where }),
    ]);

    return NextResponse.json({
      variants,
      pagination: { page, pageSize: 25, total, totalPages: Math.ceil(total / 25) },
    });
  } catch (error) {
    console.error('[GET /api/admin/inventory]', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'inventory-adjustment');
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const input = body as { variantId?: unknown; mode?: unknown; quantity?: unknown; reason?: unknown };
  if (typeof input.variantId !== 'string' || !input.variantId) {
    return NextResponse.json({ error: 'Variant is required' }, { status: 400 });
  }
  if (input.mode !== 'set' && input.mode !== 'adjust') {
    return NextResponse.json({ error: 'Adjustment mode must be set or adjust' }, { status: 400 });
  }
  if (
    typeof input.quantity !== 'number' ||
    !Number.isInteger(input.quantity) ||
    Math.abs(input.quantity) > maximumQuantity ||
    (input.mode === 'set' && input.quantity < 0) ||
    (input.mode === 'adjust' && input.quantity === 0)
  ) {
    return NextResponse.json({ error: 'Invalid stock quantity' }, { status: 400 });
  }
  if (typeof input.reason !== 'string' || input.reason.trim().length < 8 || input.reason.trim().length > 500) {
    return NextResponse.json({ error: 'A reason between 8 and 500 characters is required' }, { status: 400 });
  }
  const reason = input.reason.trim();

  try {
    const result = await db.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: input.variantId as string },
        select: { id: true, stock: true, productId: true },
      });
      if (!variant) return { kind: 'missing' as const };

      const newQuantity =
        input.mode === 'set' ? input.quantity as number : variant.stock + (input.quantity as number);
      if (!Number.isInteger(newQuantity) || newQuantity < 0 || newQuantity > maximumQuantity) {
        return { kind: 'invalid-quantity' as const };
      }

      const updated = await tx.productVariant.updateMany({
        where: { id: variant.id, stock: variant.stock },
        data: { stock: newQuantity },
      });
      if (updated.count !== 1) return { kind: 'conflict' as const };

      const difference = newQuantity - variant.stock;
      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          variantId: variant.id,
          actorId: actor.id,
          previousQuantity: variant.stock,
          newQuantity,
          difference,
          reason,
        },
      });
      const remainingStock = await tx.productVariant.count({
        where: { productId: variant.productId, stock: { gt: 0 } },
      });
      await tx.product.update({
        where: { id: variant.productId },
        data: { inStock: remainingStock > 0 },
      });
      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'inventory.adjusted',
        entityType: 'product_variant',
        entityId: variant.id,
        reason,
        before: { stock: variant.stock },
        after: { stock: newQuantity, difference },
      });

      return { kind: 'updated' as const, adjustment };
    });

    if (result.kind === 'missing') return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    if (result.kind === 'invalid-quantity') {
      return NextResponse.json({ error: 'Stock cannot be negative or exceed the supported maximum' }, { status: 400 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: 'Stock changed concurrently; reload and try again' }, { status: 409 });
    }
    return NextResponse.json({ success: true, adjustment: result.adjustment }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/inventory]', error);
    return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 });
  }
}
