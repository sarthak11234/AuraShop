import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import {
  parseOrderAddressSnapshot,
  type OrderAddressSnapshot,
} from '@/lib/account-orders';
import { buildTrackingTimeline } from '@/lib/order-lifecycle';
import { AdminPageHeading, AdminPanel, EmptyState, formatDate, formatMoney } from '../../_components';
import { OrderStatusEditor } from '../order-status-editor';
import { AdminTrackingForm } from '../admin-tracking-form';

function AddressBlock({
  title,
  address,
}: {
  title: string;
  address: OrderAddressSnapshot | null;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">{title}</p>
      {address ? (
        <address className="mt-2 text-sm not-italic leading-6 text-ink-secondary">
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
          <span className="mt-1 block font-mono text-[10px] text-ink-muted">{address.phone}</span>
        </address>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">No snapshot is available for this order.</p>
      )}
    </div>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireAdminPage();
  const { orderId } = await params;
  const [order, history] = await Promise.all([
    db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        discount: true,
        shipping: true,
        tax: true,
        total: true,
        currency: true,
        shippingAddress: true,
        billingAddress: true,
        guestEmail: true,
        guestName: true,
        guestPhone: true,
        carrier: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
        cancelledAt: true,
        cancellationReason: true,
        inventoryReservedAt: true,
        inventoryRestoredAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            productTitle: true,
            productSlug: true,
            productImage: true,
            size: true,
            quantity: true,
            price: true,
            lineTotal: true,
          },
        },
        payment: {
          select: {
            provider: true,
            status: true,
            amount: true,
            currency: true,
            method: true,
            providerPaymentId: true,
            capturedAt: true,
          },
        },
        trackingEvents: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            title: true,
            description: true,
            location: true,
            source: true,
            carrier: true,
            trackingNumber: true,
            createdAt: true,
          },
        },
      },
    }),
    db.adminAuditLog.findMany({
      where: { entityType: 'order', entityId: orderId },
      orderBy: { createdAt: 'asc' },
      select: {
        action: true,
        reason: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);
  if (!order) notFound();

  const itemSubtotal = order.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const shippingAddress = parseOrderAddressSnapshot(order.shippingAddress);
  const billingAddress = parseOrderAddressSnapshot(order.billingAddress);
  const timeline = buildTrackingTimeline({
    createdAt: order.createdAt,
    orderNumber: order.orderNumber,
    events: order.trackingEvents,
  });
  const shipped = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY'].includes(
    order.status,
  );

  return (
    <>
      <AdminPageHeading
        eyebrow="Order details"
        title={order.orderNumber}
        description={`Created ${formatDate(order.createdAt)} · status ${order.status.replaceAll('_', ' ')} · payment ${order.paymentStatus}`}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="space-y-6">
          <AdminPanel title="Customer">
            <p className="font-medium">
              {order.user
                ? order.user.name || 'Customer'
                : order.guestName || 'Guest customer'}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              {order.user ? order.user.email : order.guestEmail || 'Guest checkout'}
            </p>
            {(order.guestPhone || order.user) && (
              <p className="mt-1 text-sm text-ink-muted">
                {order.guestPhone || 'Phone is stored on the saved profile / address snapshot'}
              </p>
            )}
          </AdminPanel>

          <AdminPanel title="Purchased items (order snapshots)">
            {order.items.length === 0 ? (
              <EmptyState>No order items are recorded.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Product</th>
                      <th className="pb-3 pr-4 font-medium">Size</th>
                      <th className="pb-3 pr-4 font-medium">Quantity</th>
                      <th className="pb-3 pr-4 font-medium">Unit price</th>
                      <th className="pb-3 font-medium">Line total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 pr-4">
                          <p className="text-ink-primary">{item.productTitle}</p>
                          <p className="font-mono text-[10px] text-ink-muted">{item.productSlug}</p>
                        </td>
                        <td className="py-3 pr-4">{item.size || '—'}</td>
                        <td className="py-3 pr-4">{item.quantity}</td>
                        <td className="py-3 pr-4">{formatMoney(Number(item.price))}</td>
                        <td className="py-3">{formatMoney(Number(item.lineTotal))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <p className="flex justify-between"><span className="text-ink-secondary">Item subtotal</span><span>{formatMoney(itemSubtotal)}</span></p>
              {Number(order.discount) !== 0 && (
                <p className="flex justify-between"><span className="text-ink-secondary">Discount</span><span>−{formatMoney(Number(order.discount))}</span></p>
              )}
              <p className="flex justify-between"><span className="text-ink-secondary">Shipping</span><span>{formatMoney(Number(order.shipping))}</span></p>
              <p className="flex justify-between"><span className="text-ink-secondary">Tax</span><span>{formatMoney(Number(order.tax))}</span></p>
              <p className="flex justify-between font-semibold"><span>Order total</span><span>{formatMoney(Number(order.total))}</span></p>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Titles, images, sizes and prices above are immutable snapshots captured at
              purchase. Historical orders are never rewritten from the current catalogue.
            </p>
          </AdminPanel>

          <AdminPanel title="Address snapshots">
            <div className="grid gap-6 sm:grid-cols-2">
              <AddressBlock title="Shipping address" address={shippingAddress} />
              <AddressBlock title="Billing address" address={billingAddress} />
            </div>
          </AdminPanel>

          <AdminPanel title="Payment">
            {order.payment ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink-secondary">Provider</dt><dd>{order.payment.provider}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-secondary">Method</dt><dd>{order.payment.method ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-secondary">Provider status</dt><dd>{order.payment.status}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-secondary">Amount</dt><dd>{formatMoney(Number(order.payment.amount))} {order.payment.currency}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-secondary">Provider payment id</dt><dd className="break-all text-right">{order.payment.providerPaymentId ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-secondary">Captured</dt><dd>{order.payment.capturedAt ? formatDate(order.payment.capturedAt) : 'Not captured'}</dd></div>
              </dl>
            ) : (
              <EmptyState>No payment record is stored for this order.</EmptyState>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Order payment status: {order.paymentStatus}. Cancelling a paid online order here
              does not create a refund; use the verified payment provider workflow.
            </p>
          </AdminPanel>

          <AdminPanel title="Customer tracking timeline">
            <ol className="space-y-4">
              {timeline.map((entry) => (
                <li key={entry.key} className="border-l border-line pl-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="font-mono text-[10px] text-ink-muted">{formatDate(entry.occurredAt)}</p>
                  </div>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-ink-muted">
                    {entry.source}{entry.derived ? ' · derived from order creation' : ''}
                  </p>
                  {entry.description && <p className="mt-1 text-sm text-ink-secondary">{entry.description}</p>}
                  {(entry.location || entry.carrier || entry.trackingNumber) && (
                    <p className="mt-1 text-xs text-ink-secondary">
                      {[entry.location, entry.carrier, entry.trackingNumber].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
              Events are persisted and unique per order status. Manual fulfilment uses the
              shipping details entered below.
            </p>
          </AdminPanel>

          <AdminPanel title="Audit history">
            <ol className="space-y-4">
              {history.length === 0 ? (
                <EmptyState>No audit events are recorded for this order yet.</EmptyState>
              ) : (
                history.map((event, index) => (
                  <li key={`${event.createdAt.toISOString()}-${index}`} className="border-l border-line pl-4">
                    <p className="text-sm">{event.action.replace(/[._]/g, ' ')}</p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {event.actor.name || event.actor.email}
                      {event.reason ? ` · ${event.reason}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{formatDate(event.createdAt)}</p>
                  </li>
                ))
              )}
            </ol>
          </AdminPanel>
        </div>

        <div className="space-y-6">
          <AdminPanel title="Update status">
            <OrderStatusEditor orderId={order.id} currentStatus={order.status} />
          </AdminPanel>

          <AdminPanel title="Manual shipment and tracking">
            <AdminTrackingForm
              orderId={order.id}
              carrier={order.carrier}
              trackingNumber={order.trackingNumber}
              trackingUrl={order.trackingUrl}
              shippedAt={order.shippedAt?.toISOString() ?? null}
              shipped={shipped}
            />
          </AdminPanel>

          <AdminPanel title="Fulfilment state">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-secondary">Shipped</dt><dd>{order.shippedAt ? formatDate(order.shippedAt) : 'Not shipped'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-secondary">Inventory reserved</dt><dd>{order.inventoryReservedAt ? formatDate(order.inventoryReservedAt) : 'Not recorded'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-secondary">Inventory restored</dt><dd>{order.inventoryRestoredAt ? formatDate(order.inventoryRestoredAt) : '—'}</dd></div>
              {order.cancelledAt && (
                <>
                  <div className="flex justify-between gap-3"><dt className="text-ink-secondary">Cancelled</dt><dd>{formatDate(order.cancelledAt)}</dd></div>
                  {order.cancellationReason && (
                    <div><dt className="text-ink-secondary">Cancellation reason</dt><dd className="mt-1 text-ink-primary">{order.cancellationReason}</dd></div>
                  )}
                </>
              )}
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              Cancelling an order with a known inventory reservation restores stock exactly
              once. Legacy items without a variant reservation block automatic cancellation.
            </p>
          </AdminPanel>
        </div>
      </div>
    </>
  );
}
