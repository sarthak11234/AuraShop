import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { getAccountOverview } from '@/lib/account-data';

export async function GET() {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  try {
    const overview = await getAccountOverview(userId);
    if (!overview) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        ...overview.user,
        emailVerified: overview.user.emailVerified?.toISOString() ?? null,
        createdAt: overview.user.createdAt.toISOString(),
      },
      stats: overview.stats,
      recentOrders: overview.recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: Number(order.total),
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map((item) => ({
          productTitle: item.productTitle,
          productImage: item.productImage,
          size: item.size,
          quantity: item.quantity,
        })),
        payment: order.payment
          ? { provider: order.payment.provider, method: order.payment.method }
          : null,
      })),
    });
  } catch (error) {
    console.error('[GET /api/account]', error);
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 });
  }
}
