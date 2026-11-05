import { OrderStatus, Prisma } from '@prisma/client';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState, formatDate, formatMoney } from '../_components';

type SearchParams = Promise<{ q?: string; status?: string; page?: string; from?: string; to?: string }>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? '';
  const orderQuery = query.replace(/^#/, '');
  const status = params.status && Object.values(OrderStatus).includes(params.status as OrderStatus)
    ? params.status as OrderStatus
    : undefined;
  const rawPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const validDate = (value?: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      ? value
      : undefined;
  const from = validDate(params.from);
  const to = validDate(params.to);
  const dateRange = from || to
    ? {
        createdAt: {
          ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
        },
      }
    : {};
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...dateRange,
    ...(query
      ? {
          OR: [
            { id: { contains: orderQuery, mode: 'insensitive' } },
            { user: { name: { contains: query, mode: 'insensitive' } } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  const totalPages = Math.ceil(total / 25);

  function pageHref(nextPage: number) {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (status) next.set('status', status);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    next.set('page', String(nextPage));
    return `/admin/orders?${next.toString()}`;
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Fulfilment"
        title="Orders"
        description="Search and review customer orders. Payment method and collection status are not stored in this database."
      />
      <form className="mb-5 flex flex-wrap gap-3" action="/admin/orders">
        <label className="sr-only" htmlFor="order-search">Search orders or customers</label>
        <input
          id="order-search"
          name="q"
          defaultValue={query}
          placeholder="Order ID, customer name, or email"
          className="min-h-11 min-w-0 flex-1 border border-line bg-surface px-3 text-sm sm:min-w-72"
        />
        <label className="sr-only" htmlFor="order-status-filter">Filter by status</label>
        <select
          id="order-status-filter"
          name="status"
          defaultValue={status ?? ''}
          className="min-h-11 border border-line bg-surface px-3 text-sm"
        >
          <option value="">All statuses</option>
          {Object.values(OrderStatus).map((value) => (
            <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
        <label className="text-xs text-ink-secondary">
          From
          <input type="date" name="from" defaultValue={from} className="mt-1 block min-h-11 border border-line bg-surface px-2 text-sm" />
        </label>
        <label className="text-xs text-ink-secondary">
          To
          <input type="date" name="to" defaultValue={to} className="mt-1 block min-h-11 border border-line bg-surface px-2 text-sm" />
        </label>
        <button className="min-h-11 border border-brand px-4 text-sm text-brand hover:bg-brand hover:text-canvas">
          Search
        </button>
      </form>

      <div className="mb-5 border border-line bg-surface p-3 text-sm text-ink-secondary">
        Payment status, payment provider, shipment tracking, and shipping/billing addresses are not available in the current order model.
      </div>

      {orders.length === 0 ? (
        <EmptyState>No orders match these filters.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer / email</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Order total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-brand hover:underline">
                        #{order.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p>{order.user ? order.user.name || 'Customer' : 'Guest customer'}</p>
                      <p className="mt-1 text-xs text-ink-muted">{order.user ? order.user.email : 'Guest checkout'}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">{order._count.items}</td>
                    <td className="px-4 py-3">{formatMoney(Number(order.total))}</td>
                    <td className="px-4 py-3">{order.status.replaceAll('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-ink-secondary">
            <span>{total} orders · page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="border border-line px-3 py-2 hover:border-brand" href={pageHref(page - 1)}>Previous</Link>}
              {page < totalPages && <Link className="border border-line px-3 py-2 hover:border-brand" href={pageHref(page + 1)}>Next</Link>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
