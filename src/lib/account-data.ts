import { ACTIVE_ORDER_STATUSES } from '@/lib/order-lifecycle';
import { db } from '@/lib/db';

/** Real account statistics for the dashboard; no seeded or mocked values. */
export async function getAccountOverview(userId: string) {
  const [user, totalOrders, activeOrders, deliveredOrders, savedAddresses, recentOrders] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          emailVerified: true,
          createdAt: true,
        },
      }),
      db.order.count({ where: { userId } }),
      db.order.count({ where: { userId, status: { in: [...ACTIVE_ORDER_STATUSES] } } }),
      db.order.count({ where: { userId, status: 'DELIVERED' } }),
      db.address.count({ where: { userId, orderId: null } }),
      db.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          total: true,
          currency: true,
          createdAt: true,
          items: {
            select: {
              productTitle: true,
              productImage: true,
              size: true,
              quantity: true,
            },
          },
          payment: {
            select: { provider: true, method: true },
          },
        },
      }),
    ]);

  if (!user) return null;

  return {
    user,
    stats: {
      totalOrders,
      activeOrders,
      deliveredOrders,
      savedAddresses,
    },
    recentOrders,
  };
}
