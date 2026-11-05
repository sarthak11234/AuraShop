import { OrderStatus, Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, AdminPanel, EmptyState, formatMoney } from '../_components';

type SearchParams = Promise<{ range?: string; from?: string; to?: string }>;

function getDateRange(params: { range?: string; from?: string; to?: string }) {
  const end = new Date();
  const start = new Date(end);
  const range = params.range ?? '30';

  if (range === 'custom') {
    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;
    if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to) {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      return { start: from, end: to, label: 'Custom range', invalid: false };
    }
    return { start: new Date(end.getTime() - 29 * 86_400_000), end, label: 'Last 30 days', invalid: true };
  }

  if (range === '7' || range === '30' || range === '90') {
    start.setDate(start.getDate() - (Number(range) - 1));
    start.setHours(0, 0, 0, 0);
    return { start, end, label: `Last ${range} days`, invalid: false };
  }
  if (range === 'this-month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end, label: 'This month', invalid: false };
  }
  if (range === 'previous-month') {
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    const previousEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end: previousEnd, label: 'Previous month', invalid: false };
  }
  start.setDate(start.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  return { start, end, label: 'Last 30 days', invalid: false };
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const dateRange = getDateRange(params);
  const where: Prisma.OrderWhereInput = {
    createdAt: { gte: dateRange.start, lte: dateRange.end },
  };
  const [
    orderCount,
    cancelledCount,
    orderTotals,
    statusGroups,
    newCustomers,
    orderCustomers,
    productGroups,
  ] = await Promise.all([
    db.order.count({ where }),
    db.order.count({ where: { ...where, status: 'CANCELLED' } }),
    db.order.aggregate({
      where: { ...where, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      _sum: { total: true },
      _avg: { total: true },
    }),
    db.order.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.user.count({
      where: { role: 'CUSTOMER', createdAt: { gte: dateRange.start, lte: dateRange.end } },
    }),
    db.order.groupBy({ by: ['userId'], where, _count: { _all: true } }),
    db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: dateRange.start, lte: dateRange.end },
          status: { notIn: ['CANCELLED', 'RETURNED'] },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
  ]);
  const products = productGroups.length
    ? await db.product.findMany({
        where: { id: { in: productGroups.map(({ productId }) => productId) } },
        select: { id: true, title: true },
      })
    : [];
  const productNames = new Map(products.map(({ id, title }) => [id, title]));
  const repeatCustomers = orderCustomers.filter(({ _count }) => _count._all > 1).length;
  const statusCounts = new Map(statusGroups.map(({ status, _count }) => [status, _count._all]));
  const cancelRate = orderCount ? (cancelledCount / orderCount) * 100 : 0;

  return (
    <>
      <AdminPageHeading
        eyebrow="Store performance"
        title="Analytics"
        description={`Operational data for ${dateRange.label.toLowerCase()}.`}
      />
      {dateRange.invalid && (
        <p role="status" className="mb-5 border border-brand/40 p-3 text-sm text-brand">
          The custom date range was invalid; showing the last 30 days.
        </p>
      )}
      <form className="mb-6 flex flex-wrap items-end gap-3" action="/admin/analytics">
        <label className="text-xs text-ink-secondary">Date range
          <select name="range" defaultValue={params.range ?? '30'} className="mt-1 block min-h-11 border border-line bg-surface px-3 text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="this-month">This month</option>
            <option value="previous-month">Previous month</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="text-xs text-ink-secondary">From
          <input type="date" name="from" defaultValue={params.from} className="mt-1 block min-h-11 border border-line bg-surface px-3 text-sm" />
        </label>
        <label className="text-xs text-ink-secondary">To
          <input type="date" name="to" defaultValue={params.to} className="mt-1 block min-h-11 border border-line bg-surface px-3 text-sm" />
        </label>
        <button className="min-h-11 border border-brand px-4 text-sm text-brand">Apply</button>
      </form>

      <div className="mb-6 grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Recognized revenue', 'Unavailable'],
          ['Gross order value', formatMoney(Number(orderTotals._sum.total ?? 0))],
          ['Average order total', formatMoney(Number(orderTotals._avg.total ?? 0))],
          ['Order volume', orderCount],
          ['Cancellation rate', `${cancelRate.toFixed(1)}%`],
          ['New customers', newCustomers],
          ['Returning customers', repeatCustomers],
          ['Product units sold', productGroups.reduce((sum, item) => sum + (item._sum.quantity ?? 0), 0)],
        ].map(([label, value]) => (
          <article key={label} className="bg-surface p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">{label}</p>
            <p className="mt-3 text-xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <p className="mb-6 border border-brand/40 bg-brand/5 p-3 text-sm text-ink-secondary">
        Payment collection, refunds, net sales, payment methods, and shipment-level analytics are unavailable because transaction records are not persisted.
        Gross order value excludes cancelled and returned orders and does not imply collected revenue.
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Order status distribution">
          <ul className="space-y-2">
            {Object.values(OrderStatus).map((status) => (
              <li key={status} className="flex justify-between border-b border-line py-2 text-sm">
                <span className="text-ink-secondary">{status.replaceAll('_', ' ')}</span>
                <span className="font-mono">{statusCounts.get(status) ?? 0}</span>
              </li>
            ))}
          </ul>
        </AdminPanel>
        <AdminPanel title="Best-selling products by units">
          {productGroups.length === 0 ? (
            <EmptyState>No ordered product items in this period.</EmptyState>
          ) : (
            <ol className="divide-y divide-line">
              {productGroups.map((product) => (
                <li key={product.productId} className="flex justify-between gap-4 py-3 text-sm">
                  <span>{productNames.get(product.productId) ?? 'Archived product'}</span>
                  <span className="font-mono">{product._sum.quantity ?? 0}</span>
                </li>
              ))}
            </ol>
          )}
        </AdminPanel>
      </div>
    </>
  );
}
