import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';

export const instant = false;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

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

export default async function AccountReturnDetailPage({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view this return"
        description="Return details are only visible to the account that owns the request."
      />
    );
  }

  const { returnId } = await params;

  const returnRequest = await db.returnRequest.findFirst({
    where: { id: returnId, userId },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          total: true,
          currency: true,
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: { slug: true, category: true } },
          variant: { select: { size: true, sku: true } },
        },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      shipment: true,
      exchangeRequest: true,
      offlineRefund: true,
    },
  });

  if (!returnRequest) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/account/returns"
        className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-secondary hover:text-brand"
      >
        ← Back to returns
      </Link>

      <section className="border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="mt-2 font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
              Return {returnRequest.returnNumber}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Order{' '}
              <Link
                href={`/account/orders/${returnRequest.orderId}`}
                className="text-brand underline underline-offset-4"
              >
                {returnRequest.order.orderNumber}
              </Link>
              · Placed{' '}
              {dateFormatter.format(returnRequest.order.createdAt)}
            </p>
          </div>
          <span
            className={cn(
              'inline-flex items-center border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]',
              returnStatusStyles(returnRequest.status),
            )}
          >
            {RETURN_STATUS_LABELS[returnRequest.status]}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3 text-sm">
          <div className="border-b border-line pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Reason
            </dt>
            <dd className="mt-1 text-ink-primary">{returnRequest.returnReason}</dd>
          </div>
          <div className="border-b border-line pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Type
            </dt>
            <dd className="mt-1 text-ink-primary">{returnRequest.returnType}</dd>
          </div>
          <div className="border-b border-line pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Requested
            </dt>
            <dd className="mt-1 text-ink-primary">
              {dateFormatter.format(returnRequest.requestedAt)}
            </dd>
          </div>
          {returnRequest.resolvedAt && (
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Resolved
              </dt>
              <dd className="mt-1 text-ink-primary">
                {dateFormatter.format(returnRequest.resolvedAt)}
              </dd>
            </div>
          )}
          {returnRequest.customerComments && (
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Comments
              </dt>
              <dd className="mt-1 text-ink-secondary">
                {returnRequest.customerComments}
              </dd>
            </div>
          )}
          {returnRequest.adminNotes && (
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Admin note
              </dt>
              <dd className="mt-1 text-ink-secondary">
                {returnRequest.adminNotes}
              </dd>
            </div>
          )}
          {returnRequest.refundAmount && (
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Refund amount
              </dt>
              <dd className="mt-1 text-ink-primary">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: returnRequest.order.currency,
                }).format(Number(returnRequest.refundAmount))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <section className="border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
          Items
        </h2>
        <ul className="mt-4 divide-y divide-line">
          {returnRequest.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-line bg-canvas"
                aria-hidden="true"
              >
                <span className="font-mono text-[8px] text-ink-muted">
                  {item.variant?.size || '—'}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.product.slug}`}
                  className="block truncate text-sm font-semibold text-ink-primary hover:text-brand"
                >
                  {item.productTitle}
                </Link>
                <span className="mt-1 block font-mono text-[10px] text-ink-muted">
                  Qty {item.requestedQuantity} ·
                  {item.approvedQuantity > 0
                    ? `Approved: {item.approvedQuantity}`
                    : 'Pending approval'}
                  · {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: returnRequest.order.currency,
                  }).format(Number(item.price))} each
                </span>
              </span>
              <span className="font-mono text-sm text-ink-primary">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: returnRequest.order.currency,
                }).format(Number(item.lineTotal))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {returnRequest.shipment && (
        <section className="border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
            Return shipment
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Carrier
              </dt>
              <dd className="mt-1 text-ink-primary">
                {returnRequest.shipment.carrier || '—'}
              </dd>
            </div>
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Tracking number
              </dt>
              <dd className="mt-1 text-ink-primary">
                {returnRequest.shipment.trackingNumber || '—'}
              </dd>
            </div>
            {returnRequest.shipment.shippedAt && (
              <div className="border-b border-line pb-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Shipped
                </dt>
                <dd className="mt-1 text-ink-primary">
                  {dateFormatter.format(returnRequest.shipment.shippedAt)}
                </dd>
              </div>
            )}
            {returnRequest.shipment.receivedAt && (
              <div className="border-b border-line pb-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  Received
                </dt>
                <dd className="mt-1 text-ink-primary">
                  {dateFormatter.format(returnRequest.shipment.receivedAt)}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {returnRequest.exchangeRequest && (
        <section className="border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
            Exchange
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Status
              </dt>
              <dd className="mt-1 text-ink-primary">
                {returnRequest.exchangeRequest.status}
              </dd>
            </div>
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Replacement quantity
              </dt>
              <dd className="mt-1 text-ink-primary">
                {returnRequest.exchangeRequest.replacementQuantity}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {returnRequest.offlineRefund && (
        <section className="border border-line bg-surface p-5 sm:p-6">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
            Refund
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Status
              </dt>
              <dd className="mt-1 text-ink-primary">
                {returnRequest.offlineRefund.status}
              </dd>
            </div>
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Amount
              </dt>
              <dd className="mt-1 text-ink-primary">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: returnRequest.offlineRefund.currency,
                }).format(Number(returnRequest.offlineRefund.amount))}
              </dd>
            </div>
            <div className="border-b border-line pb-2">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Method
              </dt>
              <dd className="mt-1 text-ink-primary">
                {returnRequest.offlineRefund.method}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
          Timeline
        </h2>
        <ol className="mt-4 space-y-4">
          {returnRequest.events.map((event) => (
            <li key={event.id} className="border-l border-line pl-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{event.title}</p>
                <p className="font-mono text-[10px] text-ink-muted">
                  {dateFormatter.format(event.createdAt)}
                </p>
              </div>
              {event.actor && (
                <p className="mt-1 text-xs text-ink-secondary">
                  {event.actor.name || event.actor.email}
                </p>
              )}
              {event.description && (
                <p className="mt-1 text-sm text-ink-secondary">{event.description}</p>
              )}
            </li>
          ))}
        </ol>
      </section>
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
