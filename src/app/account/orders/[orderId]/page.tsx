import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/auth';
import {
  getCustomerOrderDetail,
  parseOrderAddressSnapshot,
  serializeCustomerOrderDetail,
  type OrderAddressSnapshot,
} from '@/lib/account-orders';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { CancelOrderButton } from '@/components/account/CancelOrderButton';
import { OrderStatusBadge } from '@/components/account/OrderStatusBadge';

export const instant = false;

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { title: 'Order details' };

  const { orderId } = await params;
  const detail = await getCustomerOrderDetail(userId, orderId);
  if (!detail) notFound();
  return { title: `Order ${detail.orderNumber}` };
}

function AddressSnapshot({
  title,
  address,
}: {
  title: string;
  address: OrderAddressSnapshot | null;
}) {
  return (
    <section className="border border-line bg-surface p-5">
      <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
        {title}
      </h2>
      {address ? (
        <address className="mt-4 text-sm not-italic leading-6 text-ink-secondary">
          <span className="block text-ink-primary">
            {address.firstName} {address.lastName}
          </span>
          {address.company && <span className="block">{address.company}</span>}
          <span className="block">{address.addressLine1}</span>
          {address.addressLine2 && <span className="block">{address.addressLine2}</span>}
          <span className="block">
            {address.city}
            {address.state ? `, ${address.state}` : ''} {address.postalCode}
          </span>
          <span className="block">{address.country}</span>
          <span className="mt-2 block font-mono text-[10px] text-ink-muted">{address.phone}</span>
        </address>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          No address snapshot is available for this older order.
        </p>
      )}
    </section>
  );
}

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  // Wait for the real request before authenticating so ownership failures can
  // return a true 404 instead of a prerendered 200 shell.
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view this order"
        description="Order details and delivery data are only shown to the account that placed the order."
      />
    );
  }

  const { orderId } = await params;
  const detail = await getCustomerOrderDetail(userId, orderId);
  if (!detail) notFound();

  const order = serializeCustomerOrderDetail(detail);
  const shippingAddress = parseOrderAddressSnapshot(detail.shippingAddress);
  const billingAddress = parseOrderAddressSnapshot(detail.billingAddress);
  const cancellation = order.cancellation;

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/account/orders"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-secondary hover:text-brand"
            >
              ← Back to orders
            </Link>
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink-primary sm:text-3xl">
              {order.orderNumber}
            </h2>
            <p className="mt-2 text-sm text-ink-secondary">
              Placed {dateFormatter.format(new Date(order.createdAt))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <Link
              href={`/account/orders/${order.id}/tracking`}
              className="inline-flex min-h-10 items-center border border-line px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
            >
              Track order
            </Link>
            {order.status === 'DELIVERED' && (
              <Link
                href={`/account/returns/new/${order.id}`}
                className="inline-flex min-h-10 items-center bg-brand px-4 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-canvas hover:bg-brand-hover"
              >
                Start a return
              </Link>
            )}
          </div>
        </div>

        {(order.carrier || order.trackingNumber) && (
          <div className="mt-5 border-t border-line pt-4 text-sm text-ink-secondary">
            {order.carrier && <span className="mr-4">Carrier: {order.carrier}</span>}
            {order.trackingNumber && (
              <span>
                Tracking number:{' '}
                {order.trackingUrl ? (
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
                )}
              </span>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="space-y-6">
          <section className="border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
              Items
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {order.items.map((item) => {
                const isImage =
                  item.productImage?.startsWith('/') || item.productImage?.startsWith('http');
                return (
                  <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <span
                      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-line bg-canvas"
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
                        <span className="font-mono text-[8px] text-ink-muted">{item.size || '—'}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/product/${item.productSlug}`}
                        className="block truncate text-sm font-semibold text-ink-primary hover:text-brand"
                      >
                        {item.productTitle}
                      </Link>
                      <span className="mt-1 block font-mono text-[10px] text-ink-muted">
                        {item.size ? `${item.size} · ` : ''}Qty {item.quantity} ·{' '}
                        {currency.format(item.price)} each
                      </span>
                    </span>
                    <span className="font-mono text-sm text-ink-primary">
                      {currency.format(item.lineTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Subtotal</dt>
                <dd>{currency.format(order.subtotal)}</dd>
              </div>
              {order.discount !== 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-secondary">Discount</dt>
                  <dd>−{currency.format(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Shipping</dt>
                <dd>{currency.format(order.shipping)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Tax</dt>
                <dd>{currency.format(order.tax)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-line pt-3 font-semibold text-ink-primary">
                <dt>Total</dt>
                <dd>{currency.format(order.total)}</dd>
              </div>
            </dl>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <AddressSnapshot title="Shipping address" address={shippingAddress} />
            <AddressSnapshot title="Billing address" address={billingAddress} />
          </div>
        </div>

        <aside className="space-y-4">
          <section className="border border-line bg-surface p-5">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
              Payment
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-secondary">Method</dt>
                <dd className="text-right text-ink-primary">
                  {order.payment?.method ?? order.payment?.provider ?? 'Not recorded'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-secondary">Order payment status</dt>
                <dd className="text-right text-ink-primary">{order.paymentStatus}</dd>
              </div>
              {order.payment && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-secondary">Provider status</dt>
                  <dd className="text-right text-ink-primary">{order.payment.status}</dd>
                </div>
              )}
              {order.payment?.capturedAt && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-secondary">Captured</dt>
                  <dd className="text-right text-ink-primary">
                    {dateFormatter.format(new Date(order.payment.capturedAt))}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-ink-muted">
              Payment records are shown exactly as persisted. VEXO does not mark an online
              payment as refunded until a provider refund has actually completed.
            </p>
          </section>

          <section className="border border-line bg-surface p-5">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
              Cancellation
            </h2>
            {cancellation.alreadyCancelled ? (
              <div className="mt-4 space-y-3 text-sm text-ink-secondary">
                <p>
                  Cancelled
                  {order.cancelledAt
                    ? ` on ${dateFormatter.format(new Date(order.cancelledAt))}`
                    : ''}
                  .
                </p>
                {order.cancellationReason && <p>Reason: {order.cancellationReason}</p>}
              </div>
            ) : cancellation.eligible ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-ink-secondary">{cancellation.reason}</p>
                <CancelOrderButton orderId={order.id} />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm leading-6 text-ink-secondary">{cancellation.reason}</p>
                <Link
                  href="/account/settings"
                  className="inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-brand"
                >
                  Contact support options →
                </Link>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
