import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { db } from '@/lib/db';

type RouteContext = { params: Promise<{ categoryId: string }> };

function isCategoryInput(body: unknown): body is {
  name: string;
  slug: string;
  description: string;
  isPublished: boolean;
} {
  if (!body || typeof body !== 'object') return false;
  const input = body as Record<string, unknown>;
  return (
    typeof input.name === 'string' &&
    input.name.trim().length >= 2 &&
    input.name.trim().length <= 80 &&
    typeof input.slug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) &&
    input.slug.length <= 80 &&
    typeof input.description === 'string' &&
    input.description.length <= 1000 &&
    typeof input.isPublished === 'boolean'
  );
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'category-write');
  if (rateLimitResponse) return rateLimitResponse;
  const { categoryId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isCategoryInput(body)) {
    return NextResponse.json({ error: 'Invalid category fields' }, { status: 400 });
  }

  try {
    const outcome = await db.$transaction(async (tx) => {
      const before = await tx.category.findUnique({ where: { id: categoryId } });
      if (!before) return null;

      const updated = await tx.category.update({
        where: { id: categoryId },
        data: {
          name: body.name.trim(),
          slug: body.slug,
          description: body.description.trim(),
          isPublished: body.isPublished,
        },
      });
      await tx.product.updateMany({
        where: { categoryId },
        data: { category: updated.name, categoryCode: updated.slug.toUpperCase() },
      });
      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'category.updated',
        entityType: 'category',
        entityId: categoryId,
        before: {
          name: before.name,
          slug: before.slug,
          isPublished: before.isPublished,
        },
        after: {
          name: updated.name,
          slug: updated.slug,
          isPublished: updated.isPublished,
        },
      });
      return updated;
    });

    if (!outcome) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    return NextResponse.json({ category: outcome });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Category identifier already exists' }, { status: 409 });
    }
    console.error('[PATCH /api/admin/categories/[categoryId]]', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'category-write');
  if (rateLimitResponse) return rateLimitResponse;
  const { categoryId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const reason =
    body && typeof body === 'object' && 'reason' in body ? (body as { reason?: unknown }).reason : null;
  if (typeof reason !== 'string' || reason.trim().length < 8 || reason.trim().length > 500) {
    return NextResponse.json({ error: 'A reason between 8 and 500 characters is required' }, { status: 400 });
  }

  try {
    const outcome = await db.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: categoryId },
        select: { id: true, name: true, slug: true, _count: { select: { products: true } } },
      });
      if (!category) return 'missing' as const;
      if (category._count.products > 0) return 'has-products' as const;

      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'category.deleted',
        entityType: 'category',
        entityId: categoryId,
        reason: reason.trim(),
        before: { name: category.name, slug: category.slug } satisfies Prisma.InputJsonObject,
      });
      await tx.category.delete({ where: { id: categoryId } });
      return 'deleted' as const;
    });

    if (outcome === 'missing') return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    if (outcome === 'has-products') {
      return NextResponse.json(
        { error: 'Reassign or remove associated products before deleting this category' },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/categories/[categoryId]]', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
