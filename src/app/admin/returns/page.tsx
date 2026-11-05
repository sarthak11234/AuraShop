import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState, formatDate } from '../(dashboard)/_components';
import type { Prisma, ReturnStatus } from '@prisma/client';

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  PARTIALLY_APPROVED: 'Partially approved',
  REJECTED: 'Rejected',
  RETURN_SHIPPED: 'Returned shipped',
  RETURN_RECEIVED: 'Return received',
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

const STATUSES: ReturnStatus[] = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'RETURN_SHIPPED',
  'RETURN_RECEIVED',
  'INSPECTION_PENDING',
  'INSPECTED',
  'REFUND_PENDING',
  'REFUND_PROCESSING',
  'REFUNDED',
  'EXCHANGE_PENDING',
  'EXCHANGE_PROCESSING',
  'EXCHANGED',
  'COMPLETED',
  'CANCELLED',
];

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; from?: string; to?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? '';
  const status =
    params.status && STATUSES.includes(params.status as ReturnStatus)
      ? (params.status as ReturnStatus)
      : undefined;
  const rawPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const from = params.from || undefined;
  const to = params.to || undefined;

  const where: Prisma.ReturnRequestWhereInput = {
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          requestedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { returnNumber: { contains: query, mode: 'insensitive' } },
            { order: { orderNumber: { contains: query, mode: 'insensitive' } } },
            { user: { name: { contains: query, mode: 'insensitive' } } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [returns, total] = await Promise.all([
    db.returnRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        returnNumber: true,
        status: true,
        returnReason: true,
        returnType: true,
        requestedAt: true,
        user: { select: { name: true, email: true } },
        order: { select: { orderNumber: true, status: true, total: true } },
        _count: { select: { items: true } },
      },
    }),
    db.returnRequest.count({ where }),
  ]);

  const totalPages = Math.ceil(total / 25);

  const stats = await Promise.all([
    db.returnRequest.count({ where: { status: 'REQUESTED' } }),
    db.returnRequest.count({ where: { status: 'UNDER_REVIEW' } }),
    db.returnRequest.count({ where: { status: 'APPROVED' } }),
    db.returnRequest.count({ where: { status: 'PARTIALLY_APPROVED' } }),
    db.returnRequest.count({ where: { status: 'REJECTED' } }),
    db.returnRequest.count({ where: { status: 'RETURN_SHIPPED' } }),
    db.returnRequest.count({ where: { status: 'RETURN_RECEIVED' } }),
    db.returnRequest.count({ where: { status: 'REFUND_PENDING' } }),
    db.returnRequest.count({ where: { status: 'REFUNDED' } }),
    db.returnRequest.count({ where: { status: 'COMPLETED' } }),
  ]);

  function pageHref(nextPage: number) {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (status) next.set('status', status);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    next.set('page', String(nextPage));
    return `/admin/returns?${next.toString()}`;
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Returns"
        title="Return requests"
        description="Review, approve, reject, and manage customer return requests. All statistics are calculated from live database records."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total', String(total), '/admin/returns'],
          ['Awaiting review', String(stats[0] + stats[1]), '/admin/returns?status=UNDER_REVIEW'],
          ['Approved', String(stats[2] + stats[3]), '/admin/returns?status=APPROVED'],
          ['Rejected', String(stats[4]), '/admin/returns?status=REJECTED'],
          ['Awaiting shipment', String(stats[5]), '/admin/returns?status=RETURN_SHIPPED'],
          ['Awaiting refund', String(stats[7]), '/admin/returns?status=REFUND_PENDING'],
          ['Completed', String(stats[9]), '/admin/returns?status=COMPLETED'],
        ].map(([label, value, href]) => (
          <a
            key={label}
            href={href}
            className="border border-line bg-surface p-4 hover:border-brand/60 transition-colors"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink-primary">{value}</p>
          </a>
        ))}
      </div>

      <div className="mt-6 border border-line bg-surface">
        <form method="get" className="p-4 border-b border-line">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Search
            </label>
            <input
              name="q"
              defaultValue={query}
              placeholder="Return ID, order, customer"
              className="min-h-10 w-64 border border-line bg-canvas px-3 text-sm"
            />
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Status
            </label>
            <select
              name="status"
              defaultValue={status ?? 'all'}
              className="min-h-10 border border-line bg-canvas px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RETURN_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-10 bg-brand px-4 font-mono text-[10px] font-bold uppercase text-canvas hover:bg-brand-hover"
            >
              Apply
            </button>
          </div>
        </form>

        {returns.length === 0 ? (
          <div className="p-8">
            <EmptyState>
              {query ? 'No returns match your search.' : 'No return requests yet.'}
            </EmptyState>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Return
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Customer
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Order
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Reason
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Status
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Requested
                </th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted hidden sm:table-cell">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {returns.map((ret) => (
                <tr key={ret.id} className="bg-surface hover:bg-elevated transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/returns/${ret.id}`}
                      className="font-mono text-sm font-bold text-ink-primary hover:text-brand"
                    >
                      {ret.returnNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {ret.user.name || ret.user.email}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {ret.order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {ret.returnReason.replaceAll('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
                        returnStatusStyles(ret.status),
                      )}
                    >
                      {RETURN_STATUS_LABELS[ret.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {formatDate(ret.requestedAt)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Link
                      href={`/admin/returns/${ret.id}`}
                      className="font-mono text-[10px] font-bold uppercase text-brand hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-line flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="font-mono text-[10px] font-bold uppercase text-ink-secondary hover:text-brand">
                ← Previous
              </Link>
            ) : (
              <span className="font-mono text-[10px] uppercase text-ink-muted">← Previous</span>
            )}
            <span className="font-mono text-[10px] uppercase text-ink-secondary">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="font-mono text-[10px] font-bold uppercase text-ink-secondary hover:text-brand">
                Next →
              </Link>
            ) : (
              <span className="font-mono text-[10px] uppercase text-ink-muted">Next →</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

function returnStatusStyles(status: ReturnStatus): string {
  const base = 'inline-flex items-center border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em]';
  const styles: Record<ReturnStatus, string> = {
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
  return base + ' ' + styles[status];
}
