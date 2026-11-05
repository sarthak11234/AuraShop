import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdminApi } from '@/lib/admin';

function getLowStockThreshold() {
  const configured = Number.parseInt(process.env.LOW_STOCK_THRESHOLD ?? '5', 10);
  return Number.isInteger(configured) && configured >= 0 ? configured : 5;
}

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const lowStockThreshold = getLowStockThreshold();
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      totalCustomers,
      totalProducts,
      lowStockVariants,
      orderValue,
      recentOrders,
    ] = await Promise.all([
      db.order.count(),
      db.order.count({ where: { status: 'PENDING' } }),
      db.order.count({ where: { status: 'DELIVERED' } }),
      db.user.count({ where: { role: 'CUSTOMER' } }),
      db.product.count({ where: { archivedAt: null } }),
      db.productVariant.count({ where: { stock: { lte: lowStockThreshold } } }),
      db.order.aggregate({
        where: { status: { notIn: ['CANCELLED', 'RETURNED'] } },
        _sum: { total: true },
      }),
      db.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          total: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return NextResponse.json({
      metrics: {
        totalOrders,
        pendingOrders,
        completedOrders,
        totalCustomers,
        totalProducts,
        lowStockVariants,
        lowStockThreshold,
        grossOrderValue: Number(orderValue._sum.total ?? 0),
        recognizedRevenue: null,
      },
      revenueUnavailableReason:
        'Payment records and collection status are not stored in the current database schema.',
      recentOrders: recentOrders.map((order) => ({
        ...order,
        total: Number(order.total),
        orderNumber: order.id.slice(-6).toUpperCase(),
      })),
    });
  } catch (error) {
    console.error('[GET /api/admin/metrics]', error);
    return NextResponse.json({ error: 'Failed to fetch admin metrics' }, { status: 500 });
  }
}
