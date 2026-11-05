import Link from 'next/link';
import { OrderStatus } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, AdminPanel, EmptyState, formatDate, formatMoney } from './_components';

function getLowStockThreshold() {
  const value = Number.parseInt(process.env.LOW_STOCK_THRESHOLD ?? '5', 10);
  return Number.isInteger(value) && value >= 0 ? value : 5;
}

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const lowStockThreshold = getLowStockThreshold();
  const [
    orderCount,
    pendingOrders,
    completedOrders,
    totalCustomers,
    totalProducts,
    lowStockVariants,
    orderTotals,
    statusGroups,
    recentOrders,
    topSelling,
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
      _avg: { total: true },
    }),
    db.order.groupBy({ by: ['status'], _count: { _all: true } }),
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
    db.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { notIn: ['CANCELLED', 'RETURNED'] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);
  const topProducts = topSelling.length
    ? await db.product.findMany({
        where: { id: { in: topSelling.map((item) => item.productId) } },
        select: { id: true, title: true },
      })
    : [];
  const productNames = new Map(topProducts.map(({ id, title }) => [id, title]));
  const orderStatusCounts = new Map(statusGroups.map(({ status, _count }) => [status, _count._all]));

  const cards = [
    { label: 'Recognized revenue', value: 'Unavailable', note: 'Payment data is not modeled' },
    { label: 'Gross order value', value: formatMoney(Number(orderTotals._sum.total ?? 0)), note: 'Excludes cancelled/returned orders; not proof of collection' },
    { label: 'Total orders', value: orderCount, note: 'All order records' },
    { label: 'Pending orders', value: pendingOrders, note: 'Awaiting confirmation' },
    { label: 'Delivered orders', value: completedOrders, note: 'Marked delivered' },
    { label: 'Average order total', value: formatMoney(Number(orderTotals._avg.total ?? 0)), note: 'Excludes cancelled/returned orders' },
    { label: 'Customers', value: totalCustomers, note: 'Registered customer accounts' },
    { label: 'Low-stock variants', value: lowStockVariants, note: `At or below ${lowStockThreshold} units` },
    { label: 'Active catalogue products', value: totalProducts, note: 'Excludes archived products' },
  ];

  return (
    <>
      <AdminPageHeading
        eyebrow="Store operations"
        title="Overview"
        description="Live operational counts from the store database."
      />

      <section aria-label="Store metrics" className="mb-6 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, note }) => (
          <article key={label} className="min-h-28 bg-surface p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-ink-muted">{note}</p>
          </article>
        ))}
      </section>

      <div className="mb-6 border border-brand/40 bg-brand/5 p-4 text-sm text-ink-secondary">
        Revenue, payment status, provider transactions, refunds, addresses, and payment method are not available:
        the current database schema does not persist them. Order totals below are not represented as collected revenue.
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Order status distribution">
          <ul className="grid gap-3 sm:grid-cols-2">
            {Object.values(OrderStatus).map((status) => (
              <li key={status} className="flex items-center justify-between border-b border-line py-2 text-sm">
                <span className="text-ink-secondary">{status.replaceAll('_', ' ')}</span>
                <span className="font-mono">{orderStatusCounts.get(status) ?? 0}</span>
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel title="Top ordered products">
          {topSelling.length === 0 ? (
            <EmptyState>No order items are available yet.</EmptyState>
          ) : (
            <ol className="divide-y divide-line">
              {topSelling.map((item, index) => (
                <li key={item.productId} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="text-ink-secondary">
                    <span className="mr-3 font-mono text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                    {productNames.get(item.productId) ?? 'Archived product'}
                  </span>
                  <span className="font-mono">{item._sum.quantity ?? 0} units</span>
                </li>
              ))}
            </ol>
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Recent orders">
        {recentOrders.length === 0 ? (
          <EmptyState>No orders found.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Order</th>
                  <th className="pb-3 pr-4 font-medium">Customer</th>
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">Items</th>
                  <th className="pb-3 pr-4 font-medium">Order total</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-brand hover:underline">
                        #{order.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{order.user ? order.user.name || order.user.email : 'Guest customer'}</td>
                    <td className="py-3 pr-4 text-ink-secondary">{formatDate(order.createdAt)}</td>
                    <td className="py-3 pr-4">{order._count.items}</td>
                    <td className="py-3 pr-4">{formatMoney(Number(order.total))}</td>
                    <td className="py-3">{order.status.replaceAll('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
