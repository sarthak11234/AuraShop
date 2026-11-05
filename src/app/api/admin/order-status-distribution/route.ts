import { OrderStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin';
import { db } from '@/lib/db';

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const groups = await db.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const counts = new Map(groups.map((group) => [group.status, group._count._all]));

    return NextResponse.json(
      Object.values(OrderStatus).map((status) => ({
        status,
        count: counts.get(status) ?? 0,
      })),
    );
  } catch (error) {
    console.error('[GET /api/admin/order-status-distribution]', error);
    return NextResponse.json(
      { error: 'Failed to fetch order status distribution' },
      { status: 500 },
    );
  }
}
