import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi, writeAdminAudit } from '@/lib/admin';
import { db } from '@/lib/db';

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

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isPublished: true,
        _count: { select: { products: true } },
      },
    });
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('[GET /api/admin/categories]', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'category-write');
  if (rateLimitResponse) return rateLimitResponse;

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
    const category = await db.$transaction(async (tx) => {
      const created = await tx.category.create({
        data: {
          name: body.name.trim(),
          slug: body.slug,
          description: body.description.trim(),
          isPublished: body.isPublished,
        },
      });
      await writeAdminAudit(tx, {
        actorId: actor.id,
        action: 'category.created',
        entityType: 'category',
        entityId: created.id,
        after: {
          name: created.name,
          slug: created.slug,
          isPublished: created.isPublished,
        } satisfies Prisma.InputJsonObject,
      });
      return created;
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Category identifier already exists' }, { status: 409 });
    }
    console.error('[POST /api/admin/categories]', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
