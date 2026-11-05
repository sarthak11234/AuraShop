import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { validateProductBody } from '@/lib/admin-products';
import { db } from '@/lib/db';

type RouteContext = { params: Promise<{ productId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const { productId } = await params;

  try {
    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        categoryId: true,
        description: true,
        details: true,
        images: true,
        price: true,
        version: true,
        isNew: true,
        isPublished: true,
        archivedAt: true,
        variants: { select: { size: true, stock: true, sku: true } },
      },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ ...product, price: Number(product.price) });
  } catch (error) {
    console.error('[GET /api/admin/products/[productId]]', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'product-write');
  if (rateLimitResponse) return rateLimitResponse;
  const { productId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body === 'object' && body !== null && 'action' in body) {
    const { action, reason } = body as { action?: unknown; reason?: unknown };
    if (!['archive', 'publish', 'unpublish'].includes(String(action))) {
      return NextResponse.json({ error: 'Invalid product action' }, { status: 400 });
    }
    if (typeof reason !== 'string' || reason.trim().length < 8 || reason.trim().length > 500) {
      return NextResponse.json({ error: 'A reason between 8 and 500 characters is required' }, { status: 400 });
    }

    try {
      const outcome = await db.$transaction(async (tx) => {
        const before = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, isPublished: true, archivedAt: true },
        });
        if (!before) return null;

        const data =
          action === 'archive'
            ? { isPublished: false, archivedAt: new Date() }
            : action === 'publish'
              ? { isPublished: true, archivedAt: null }
              : { isPublished: false };
        const after = await tx.product.update({ where: { id: productId }, data });
        await writeAdminAudit(tx, {
          actorId: actor.id,
          action: `product.${action === 'archive' ? 'archived' : action === 'publish' ? 'published' : 'unpublished'}`,
          entityType: 'product',
          entityId: productId,
          reason: reason.trim(),
          before: {
            isPublished: before.isPublished,
            archivedAt: before.archivedAt?.toISOString() ?? null,
          },
          after: {
            isPublished: after.isPublished,
            archivedAt: after.archivedAt?.toISOString() ?? null,
          },
        });
        return { isPublished: after.isPublished, archivedAt: after.archivedAt };
      });

      if (!outcome) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      return NextResponse.json({ success: true, ...outcome });
    } catch (error) {
      console.error('[PATCH /api/admin/products/[productId]]', error);
      return NextResponse.json({ error: 'Failed to update product status' }, { status: 500 });
    }
  }

  const validated = validateProductBody(body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const category = await db.category.findUnique({ where: { id: validated.data.categoryId } });
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 400 });

    const outcome = await db.$transaction(async (tx) => {
      const before = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          slug: true,
          categoryId: true,
          price: true,
          isPublished: true,
          archivedAt: true,
        },
      });
      if (!before) return null;

      const product = await tx.product.update({
        where: { id: productId },
        data: {
          title: validated.data.title,
          slug: validated.data.slug,
          subtitle: validated.data.subtitle,
          category: category.name,
          categoryCode: category.slug.toUpperCase(),
          categoryId: category.id,
          description: validated.data.description,
          details: validated.data.details,
          images: validated.data.images,
          price: validated.data.price,
          version: validated.data.version,
          isNew: validated.data.isNew,
          isPublished: validated.data.isPublished,
        },
        select: { id: true, title: true, slug: true },
      });

      const existingSizes = await tx.productVariant.findMany({
        where: { productId },
        select: { size: true },
      });
      const currentSizes = new Set(existingSizes.map(({ size }) => size.toLowerCase()));
      for (const size of validated.data.sizes) {
        if (!currentSizes.has(size.toLowerCase())) {
          await tx.productVariant.create({ data: { productId, size, stock: 0 } });
        }
      }

      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'product.updated',
        entityType: 'product',
        entityId: productId,
        before: {
          title: before.title,
          slug: before.slug,
          categoryId: before.categoryId,
          price: Number(before.price),
          isPublished: before.isPublished,
        },
        after: {
          title: product.title,
          slug: product.slug,
          categoryId: category.id,
          price: validated.data.price,
          isPublished: validated.data.isPublished,
        },
      });
      return product;
    });

    if (!outcome) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ product: outcome });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A product with that slug already exists' }, { status: 409 });
    }
    console.error('[PATCH /api/admin/products/[productId]]', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}
