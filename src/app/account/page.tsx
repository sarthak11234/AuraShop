import Link from 'next/link';
import { auth } from '@/auth';
import { getAccountOverview } from '@/lib/account-data';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';

// Account data is per-customer and must be resolved at request time.
export const instant = false;

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default async function AccountDashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view your account"
        description="Your dashboard shows only orders, addresses and history that belong to the account you sign in with."
      />
    );
  }

  const overview = await getAccountOverview(userId);
  if (!overview) {
    return (
      <section className="border border-line bg-surface p-8">
        <h2 className="font-display text-2xl font-semibold">Account unavailable</h2>
        <p className="mt-3 text-sm text-ink-secondary">
          Your session is valid but the account record no longer exists. Sign out and sign in
          again to recreate access.
        </p>
      </section>
    );
  }

  const { user, stats, recentOrders } = overview;
  const firstName = user.name?.trim().split(/\s+/)[0] || 'there';

  const statCards = [
    { label: 'Total orders', value: stats.totalOrders, href: '/account/orders' },
    { label: 'Active orders', value: stats.activeOrders, href: '/account/orders' },
    { label: 'Delivered', value: stats.deliveredOrders, href: '/account/orders?status=DELIVERED' },
    { label: 'Saved addresses', value: stats.savedAddresses, href: '/account/addresses' },
  ] as const;

  return (
    <div className="space-y-8">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
          Welcome back
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
          Hello, {firstName}.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
          Review your orders, keep delivery details current and manage the pieces you have
          saved. Every summary on this page is calculated from your own account records.
        </p>
        {!user.phone && (
          <p className="mt-5 border border-line bg-canvas px-4 py-3 text-sm text-ink-secondary">
            Add a phone number to your{' '}
            <Link href="/account/profile" className="text-brand underline underline-offset-4">
              profile
            </Link>{' '}
            so delivery updates can reach you.
          </p>
        )}
      </section>

      <section aria-labelledby="account-stats-heading">
        <h2
          id="account-stats-heading"
          className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary"
        >
          Account summary
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="border border-line bg-surface p-5 transition-colors hover:border-brand/60"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                {stat.label}
              </p>
              <p className="mt-3 font-display text-3xl font-bold text-ink-primary">{stat.value}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-orders-heading">
        <div className="flex items-end justify-between gap-4">
          <h2
            id="recent-orders-heading"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary"
          >
            Recent orders
          </h2>
          <Link
            href="/account/orders"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-brand"
          >
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4 border border-line bg-surface p-8 text-center">
            <p className="font-display text-xl font-semibold">No orders yet</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">
              Orders placed while signed in appear here. Browse the collection to start your
              first order.
            </p>
            <Link
              href="/collections"
              className="mt-6 inline-flex min-h-11 items-center bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
            >
              Explore collections
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="block border border-line bg-surface p-5 transition-colors hover:border-brand/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-bold text-ink-primary">
                      {order.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {dateFormatter.format(order.createdAt)} · {order.items.length}{' '}
                      {order.items.length === 1 ? 'line' : 'lines'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <p className="font-mono text-sm font-bold">
                      {currency.format(Number(order.total))}
                    </p>
                  </div>
                </div>
                <p className="mt-3 truncate text-sm text-ink-secondary">
                  {order.items
                    .map((item) => `${item.productTitle}${item.size ? ` · ${item.size}` : ''}`)
                    .join(' / ')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
