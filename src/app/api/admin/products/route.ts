import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { db } from '@/lib/db';
import { validateProductBody } from '@/lib/admin-products';

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const query = params.get('q')?.trim().slice(0, 100);
  const where: Prisma.ProductWhereInput = {
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  try {
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * 25,
        take: 25,
        select: {
          id: true,
          title: true,
          slug: true,
          category: true,
          price: true,
          images: true,
          inStock: true,
          isPublished: true,
          archivedAt: true,
          createdAt: true,
          variants: { select: { stock: true } },
        },
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      products: products.map((product) => ({
        ...product,
        price: Number(product.price),
        availableStock: product.variants.reduce((totalStock, variant) => totalStock + variant.stock, 0),
        variants: undefined,
      })),
      pagination: { page, pageSize: 25, total, totalPages: Math.ceil(total / 25) },
    });
  } catch (error) {
    console.error('[GET /api/admin/products]', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'product-write');
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = validateProductBody(body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const category = await db.category.findUnique({ where: { id: validated.data.categoryId } });
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 400 });

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
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
          inStock: false,
          variants: {
            create: validated.data.sizes.map((size) => ({ size, stock: 0 })),
          },
        },
        select: { id: true, title: true, slug: true },
      });

      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'product.created',
        entityType: 'product',
        entityId: created.id,
        after: {
          title: created.title,
          slug: created.slug,
          categoryId: category.id,
          isPublished: validated.data.isPublished,
        },
      });
      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A product with that slug already exists' }, { status: 409 });
    }
    console.error('[POST /api/admin/products]', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
