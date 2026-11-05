import { OrderStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { rateLimitAdminAction, requireAdminApi } from '@/lib/admin';
import { db } from '@/lib/db';

const pageSizeLimit = 50;

export async function GET(request: Request) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;
  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'order-read', 60);
  if (rateLimitResponse) return rateLimitResponse;

  const params = new URL(request.url).searchParams;
  const rawPage = Number.parseInt(params.get('page') ?? '1', 10);
  const rawPageSize = Number.parseInt(params.get('pageSize') ?? '20', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const pageSize = Number.isInteger(rawPageSize)
    ? Math.min(pageSizeLimit, Math.max(1, rawPageSize))
    : 20;
  const search = params.get('q')?.trim().slice(0, 100);
  const orderSearch = search?.replace(/^#/, '');
  const status = params.get('status');
  const from = params.get('from');
  const to = params.get('to');

  if (status && !Object.values(OrderStatus).includes(status as OrderStatus)) {
    return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
  }
  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
    return NextResponse.json({ error: 'Invalid date filter' }, { status: 400 });
  }

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as OrderStatus } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: orderSearch, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  try {
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        total: Number(order.total),
        orderNumber: order.id.slice(-6).toUpperCase(),
        itemCount: order._count.items,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('[GET /api/admin/orders]', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
