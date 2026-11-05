import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { db } from '@/lib/db';
import { Prisma, ReturnStatus } from '@prisma/client';

const pageSizeLimit = 50;

export async function GET(request: Request) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(
    actor.id,
    'return-read',
    60,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const params = new URL(request.url).searchParams;
  const page = Math.max(
    1,
    Number.parseInt(params.get('page') ?? '1', 10) || 1,
  );
  const pageSize = Math.min(
    pageSizeLimit,
    Math.max(1, Number.parseInt(params.get('pageSize') ?? '20', 10) || 20),
  );
  const status = params.get('status');
  const validatedStatus =
    status && Object.values(ReturnStatus).includes(status as ReturnStatus)
      ? (status as ReturnStatus)
      : undefined;
  const search = params.get('q')?.trim().slice(0, 100);
  const from = params.get('from') || undefined;
  const to = params.get('to') || undefined;

  const where: Prisma.ReturnRequestWhereInput = {
    ...(validatedStatus ? { status: validatedStatus } : {}),
    ...(from || to
      ? {
          requestedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { returnNumber: { contains: search, mode: 'insensitive' } },
            { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  try {
    const [returns, total] = await Promise.all([
      db.returnRequest.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: { select: { orderNumber: true, status: true, total: true } },
          items: {
            select: {
              id: true,
              productTitle: true,
              requestedQuantity: true,
              approvedQuantity: true,
              price: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.returnRequest.count({ where }),
    ]);

    return NextResponse.json({
      returns,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('[GET /api/admin/returns]', error);
    return NextResponse.json({ error: 'Failed to fetch returns' }, { status: 500 });
  }
}
