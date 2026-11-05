import Link from 'next/link';
import type { OrderStatus } from '@prisma/client';
import { auth } from '@/auth';
import {
  CUSTOMER_ORDER_PAGE_SIZE,
  getCustomerOrderList,
  isCustomerOrderStatus,
  parseCustomerOrderPage,
  parseCustomerOrderSort,
} from '@/lib/account-orders';
import { ORDER_STATUS_LABELS } from '@/lib/order-lifecycle';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';

export const instant = false;

type SearchParams = Promise<{ status?: string; sort?: string; page?: string }>;

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

function ordersHref({
  status,
  sort,
  page,
}: {
  status: string;
  sort: string;
  page: number;
}) {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (sort !== 'newest') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/account/orders?${query}` : '/account/orders';
}

export default async function AccountOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view order history"
        description="Order history is limited to orders placed by the account you sign in with. Guest orders remain available through their private order link."
      />
    );
  }

  const params = await searchParams;
  const status =
    params.status && isCustomerOrderStatus(params.status) ? params.status : undefined;
  const sort = parseCustomerOrderSort(params.sort);
  const page = parseCustomerOrderPage(params.page);

  const result = await getCustomerOrderList({
    userId,
    status,
    sort,
    page,
    pageSize: CUSTOMER_ORDER_PAGE_SIZE,
  });

  const filterStatus = status ?? 'all';
  const statusOptions = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Order history</h2>
            <p className="mt-2 text-sm text-ink-secondary">
              {result.total} {result.total === 1 ? 'order' : 'orders'} found for your account.
            </p>
          </div>
          <Link
            href="/collections"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-brand"
          >
            Continue shopping →
          </Link>
        </div>

        <form method="get" action="/account/orders" className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div>
            <label htmlFor="orders-status" className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Status
            </label>
            <select
              id="orders-status"
              name="status"
              defaultValue={filterStatus}
              className="mt-2 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {ORDER_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="orders-sort" className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Sort
            </label>
            <select
              id="orders-sort"
              name="sort"
              defaultValue={sort}
              className="mt-2 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
            >
              Apply
            </button>
            {(filterStatus !== 'all' || sort !== 'newest') && (
              <Link
                href="/account/orders"
                className="inline-flex min-h-11 items-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-secondary hover:text-ink-primary"
              >
                Reset
              </Link>
            )}
          </div>
        </form>
      </section>

      {result.orders.length === 0 ? (
        <section className="border border-line bg-surface p-8 text-center">
          <p className="font-display text-xl font-semibold">
            {filterStatus === 'all' ? 'No orders yet' : 'No orders match this filter'}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">
            {filterStatus === 'all'
              ? 'Orders placed while signed in appear here with their current status and tracking timeline.'
              : 'Try a different status filter or view all orders.'}
          </p>
          {filterStatus === 'all' ? (
            <Link
              href="/collections"
              className="mt-6 inline-flex min-h-11 items-center bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
            >
              Explore collections
            </Link>
          ) : (
            <Link
              href="/account/orders"
              className="mt-6 inline-flex min-h-11 items-center border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
            >
              View all orders
            </Link>
          )}
        </section>
      ) : (
        <>
          <ul className="space-y-4">
            {result.orders.map((order) => (
              <li key={order.id} className="border border-line bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="font-mono text-sm font-bold text-ink-primary hover:text-brand"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-1 text-xs text-ink-muted">
                      {dateFormatter.format(order.createdAt)} ·{' '}
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                      {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1
                        ? 'item'
                        : 'items'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <p className="font-mono text-sm font-bold">{currency.format(Number(order.total))}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-3">
                  {order.items.map((item, index) => {
                    const isImage =
                      item.productImage?.startsWith('/') || item.productImage?.startsWith('http');
                    return (
                      <li key={`${order.id}-${index}`} className="flex items-center gap-3 text-sm">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-line bg-canvas"
                          aria-hidden="true"
                        >
                          {isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.productImage ?? ''}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="font-mono text-[8px] text-ink-muted">
                              {item.size || '—'}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 text-ink-secondary">
                          <span className="block truncate text-ink-primary">{item.productTitle}</span>
                          <span className="font-mono text-[10px] text-ink-muted">
                            {item.size ? `${item.size} · ` : ''}
                            Qty {item.quantity} · {currency.format(Number(item.price))}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-xs text-ink-muted">
                    {order.payment?.method ?? order.payment?.provider ?? 'Payment'} ·{' '}
                    {order.paymentStatus}
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href={`/account/orders/${order.id}/tracking`}
                      className="inline-flex min-h-9 items-center border border-line px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-secondary hover:border-brand hover:text-ink-primary"
                    >
                      Track
                    </Link>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="inline-flex min-h-9 items-center bg-brand px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-canvas hover:bg-brand-hover"
                    >
                      View order
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {result.totalPages > 1 && (
            <nav aria-label="Order history pagination" className="flex items-center justify-between gap-4 border border-line bg-surface px-4 py-3">
              {result.page > 1 ? (
                <Link
                  href={ordersHref({ status: filterStatus, sort, page: result.page - 1 })}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-secondary hover:text-ink-primary"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                  ← Previous
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-secondary">
                Page {result.page} of {result.totalPages}
              </span>
              {result.page < result.totalPages ? (
                <Link
                  href={ordersHref({ status: filterStatus, sort, page: result.page + 1 })}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-secondary hover:text-ink-primary"
                >
                  Next →
                </Link>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                  Next →
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
