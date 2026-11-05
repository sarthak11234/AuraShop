import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import type { Prisma, ReturnStatus } from '@prisma/client';
import { cn } from '@/lib/utils';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';

export const instant = false;

type SearchParams = Promise<{ status?: string; page?: string }>;

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const RETURN_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  PARTIALLY_APPROVED: 'Partially approved',
  REJECTED: 'Rejected',
  RETURN_SHIPPED: 'Shipped',
  RETURN_RECEIVED: 'Received',
  INSPECTION_PENDING: 'Inspection pending',
  INSPECTED: 'Inspected',
  REFUND_PENDING: 'Refund pending',
  REFUND_PROCESSING: 'Refund processing',
  REFUNDED: 'Refunded',
  EXCHANGE_PENDING: 'Exchange pending',
  EXCHANGE_PROCESSING: 'Exchange processing',
  EXCHANGED: 'Exchanged',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function returnsHref({ status, page }: { status: string; page: number }) {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/account/returns?${query}` : '/account/returns';
}

export default async function AccountReturnsPage({
  searchParams,
}: { searchParams: SearchParams }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view returns"
        description="Return requests are only shown for the account you sign in with."
      />
    );
  }

  const params = await searchParams;
  const status = (params.status || 'all') as ReturnStatus | 'all';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const where: Prisma.ReturnRequestWhereInput = {
    userId,
    ...(status !== 'all' ? { status } : {}),
  };

  const [returns, total] = await Promise.all([
    db.returnRequest.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, status: true } },
        items: {
          select: {
            id: true,
            productTitle: true,
            requestedQuantity: true,
            approvedQuantity: true,
            price: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, title: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 10,
      take: 10,
    }),
    db.returnRequest.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / 10);

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Returns</h2>
            <p className="mt-2 text-sm text-ink-secondary">
              {total} {total === 1 ? 'return request' : 'return requests'} found for your
              account.
            </p>
          </div>
          <Link
            href="/collections"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-brand"
          >
            Continue shopping →
          </Link>
        </div>

        <form method="get" action="/account/returns" className="mt-6 border-t border-line pt-4">
          <div className="flex flex-wrap gap-4">
            <label htmlFor="returns-status" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Status
            </label>
            <select
              id="returns-status"
              name="status"
              defaultValue={status}
              className="mt-2 min-h-11 border border-line bg-canvas px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.entries(RETURN_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="mt-2 min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
            >
              Apply
            </button>
            {(status !== 'all') && (
              <Link
                href="/account/returns"
                className="mt-2 inline-flex min-h-11 items-center border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary hover:border-brand hover:text-ink-primary"
              >
                Reset
              </Link>
            )}
          </div>
        </form>
      </section>

      {returns.length === 0 ? (
        <section className="border border-line bg-surface p-8 text-center">
          <p className="font-display text-xl font-semibold">
            {status === 'all' ? 'No returns yet' : 'No returns match this filter'}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">
            {status === 'all'
              ? 'Return requests you submit will appear here with their current status.'
              : 'Try a different status filter or view all returns.'}
          </p>
          {status === 'all' ? (
            <Link
              href="/account/orders?status=DELIVERED"
              className="mt-6 inline-flex min-h-11 items-center bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
            >
              Start a return →
            </Link>
          ) : (
            <Link
              href="/account/returns"
              className="mt-6 inline-flex min-h-11 items-center border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary hover:border-brand hover:text-ink-primary"
            >
              View all returns
            </Link>
          )}
        </section>
      ) : (
        <>
          <ul className="space-y-4">
            {returns.map((ret) => (
              <li key={ret.id} className="border border-line bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <Link
                      href={`/account/returns/${ret.id}`}
                      className="font-mono text-sm font-bold text-ink-primary hover:text-brand"
                    >
                      {ret.returnNumber}
                    </Link>
                    <p className="mt-1 text-xs text-ink-muted">
                      {dateFormatter.format(ret.createdAt)} · Order{' '}
                      <Link
                        href={`/account/orders/${ret.orderId}`}
                        className="text-brand underline underline-offset-4"
                      >
                        {ret.order.orderNumber}
                      </Link>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex items-center border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
                        returnStatusStyles(ret.status),
                      )}
                    >
                      {RETURN_STATUS_LABELS[ret.status]}
                    </span>
                    <p className="font-mono text-sm font-bold text-ink-primary">
                      {ret.items.reduce((sum, item) => sum + item.requestedQuantity, 0)} item(s)
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {ret.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 text-ink-secondary">
                      <span>{item.productTitle}</span>
                      <span>
                        {item.approvedQuantity > 0
                          ? `Approved: ${item.approvedQuantity}`
                          : `Requested: ${item.requestedQuantity}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Link
                    href={`/account/returns/${ret.id}`}
                    className="inline-flex min-h-9 items-center bg-brand px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-canvas hover:bg-brand-hover"
                  >
                    View details
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Returns pagination" className="flex items-center justify-between gap-4 border border-line bg-surface px-4 py-3">
              {page > 1 ? (
                <Link
                  href={returnsHref({ status, page: page - 1 })}
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
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={returnsHref({ status, page: page + 1 })}
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

function returnStatusStyles(status: string): string {
  const base = 'inline-flex items-center border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]';
  const styles: Record<string, string> = {
    REQUESTED: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    UNDER_REVIEW: 'border-cyan/40 bg-cyan/10 text-cyan',
    APPROVED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    PARTIALLY_APPROVED: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    REJECTED: 'border-brand/40 bg-brand/10 text-brand',
    RETURN_SHIPPED: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    RETURN_RECEIVED: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    INSPECTION_PENDING: 'border-cyan/40 bg-cyan/10 text-cyan',
    INSPECTED: 'border-cyan/40 bg-cyan/10 text-cyan',
    REFUND_PENDING: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    REFUND_PROCESSING: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    REFUNDED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    EXCHANGE_PENDING: 'border-cyan/40 bg-cyan/10 text-cyan',
    EXCHANGE_PROCESSING: 'border-cyan/40 bg-cyan/10 text-cyan',
    EXCHANGED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    COMPLETED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    CANCELLED: 'border-brand/40 bg-brand/10 text-brand',
  };
  return base + ' ' + (styles[status] || '');
}
