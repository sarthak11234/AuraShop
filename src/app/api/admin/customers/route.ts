import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi } from '@/lib/admin';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'customer-read', 60);
  if (rateLimitResponse) return rateLimitResponse;
  const params = new URL(request.url).searchParams;
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const query = params.get('q')?.trim().slice(0, 100);
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  try {
    const [customers, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 25,
        take: 25,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    const spending = await db.order.groupBy({
      by: ['userId'],
      where: {
        userId: { in: customers.map(({ id }) => id) },
        status: { notIn: ['CANCELLED', 'RETURNED'] },
      },
      _sum: { total: true },
    });
    const values = new Map(spending.map((item) => [item.userId, Number(item._sum.total ?? 0)]));

    return NextResponse.json({
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        createdAt: customer.createdAt,
        totalOrders: customer._count.orders,
        grossOrderValue: values.get(customer.id) ?? 0,
      })),
      orderValueNote: 'Collection status is unavailable because payment records are not modeled.',
      pagination: { page, pageSize: 25, total, totalPages: Math.ceil(total / 25) },
    });
  } catch (error) {
    console.error('[GET /api/admin/customers]', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
