import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/auth';
import { getCustomerOrderDetail } from '@/lib/account-orders';
import { buildTrackingTimeline } from '@/lib/order-lifecycle';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';

export const instant = false;

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

const SOURCE_LABELS: Record<string, string> = {
  SYSTEM: 'VEXO system',
  ADMIN: 'VEXO fulfilment',
  CUSTOMER: 'Customer action',
  CARRIER: 'Carrier update',
  ORDER: 'Order record',
};

export default async function AccountOrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view tracking"
        description="Tracking data is private to the account that owns this order."
      />
    );
  }

  const { orderId } = await params;
  const order = await getCustomerOrderDetail(userId, orderId);
  if (!order) notFound();

  const timeline = buildTrackingTimeline({
    createdAt: order.createdAt,
    orderNumber: order.orderNumber,
    events: order.trackingEvents,
  });
  const hasShipmentDetails = Boolean(
    order.carrier || order.trackingNumber || order.trackingUrl || order.shippedAt,
  );

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <Link
          href={`/account/orders/${order.id}`}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-secondary hover:text-brand"
        >
          ← Back to order
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Tracking</h2>
            <p className="mt-2 font-mono text-sm text-ink-secondary">{order.orderNumber}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-secondary">
          This timeline is built only from persisted order records. VEXO does not generate
          estimated delivery dates or courier events that have not been recorded.
        </p>
      </section>

      <section className="border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
          Shipment details
        </h2>
        {hasShipmentDetails ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Carrier</dt>
              <dd className="mt-1 text-ink-primary">{order.carrier ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Tracking number</dt>
              <dd className="mt-1 break-all text-ink-primary">
                {order.trackingNumber ? (
                  order.trackingUrl ? (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand underline underline-offset-4"
                    >
                      {order.trackingNumber}
                    </a>
                  ) : (
                    order.trackingNumber
                  )
                ) : (
                  'Not recorded'
                )}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Shipped</dt>
              <dd className="mt-1 text-ink-primary">
                {order.shippedAt ? dateFormatter.format(new Date(order.shippedAt)) : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Fulfilment</dt>
              <dd className="mt-1 text-ink-primary">Manual fulfilment</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-sm leading-6 text-ink-secondary">
            No carrier or tracking number has been recorded yet. Shipment details appear only
            after VEXO fulfilment records them.
          </p>
        )}
      </section>

      <section className="border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
          Timeline
        </h2>
        <ol className="mt-5 space-y-0">
          {timeline.map((entry, index) => (
            <li key={entry.key} className="relative flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <span
                  className={
                    index === timeline.length - 1
                      ? 'mt-1 h-3 w-3 border border-brand bg-brand'
                      : 'mt-1 h-3 w-3 border border-line bg-canvas'
                  }
                  aria-hidden="true"
                />
                {index < timeline.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-primary">{entry.title}</h3>
                  <time className="font-mono text-[10px] text-ink-muted" dateTime={entry.occurredAt}>
                    {dateFormatter.format(new Date(entry.occurredAt))}
                  </time>
                </div>
                {entry.description && (
                  <p className="mt-1 text-sm leading-6 text-ink-secondary">{entry.description}</p>
                )}
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">
                  {SOURCE_LABELS[entry.source] ?? entry.source}
                  {entry.derived ? ' · derived from order creation' : ''}
                </p>
                {(entry.location || entry.carrier || entry.trackingNumber) && (
                  <p className="mt-1 text-xs text-ink-secondary">
                    {[entry.location, entry.carrier, entry.trackingNumber]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {timeline.length <= 1 && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
            No fulfilment updates have been recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
