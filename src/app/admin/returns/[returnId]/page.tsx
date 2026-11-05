import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, AdminPanel, EmptyState, formatDate, formatMoney } from '../../(dashboard)/_components';
import { cn } from '@/lib/utils';
import type { ReturnStatus } from '@prisma/client';

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

export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  await requireAdminPage();

  const { returnId } = await params;

  const returnRequest = await db.returnRequest.findUnique({
    where: { id: returnId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          total: true,
          currency: true,
          payment: {
            select: { provider: true, method: true, status: true, amount: true },
          },
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: { slug: true, category: true } },
          variant: { select: { size: true, sku: true, stock: true } },
          inspections: {
            orderBy: { createdAt: 'desc' },
            include: { inspector: { select: { id: true, name: true, email: true } } },
          },
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

  const canTransition = (next: ReturnStatus) => {
    const transitions: Record<ReturnStatus, ReturnStatus[]> = {
      REQUESTED: ['UNDER_REVIEW', 'CANCELLED'],
      UNDER_REVIEW: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
      APPROVED: ['RETURN_SHIPPED', 'CANCELLED'],
      PARTIALLY_APPROVED: ['RETURN_SHIPPED', 'CANCELLED'],
      REJECTED: [],
      RETURN_SHIPPED: ['RETURN_RECEIVED'],
      RETURN_RECEIVED: ['INSPECTION_PENDING'],
      INSPECTION_PENDING: ['INSPECTED'],
      INSPECTED: ['REFUND_PENDING', 'EXCHANGE_PENDING', 'REJECTED'],
      REFUND_PENDING: ['REFUND_PROCESSING'],
      REFUND_PROCESSING: ['REFUNDED'],
      REFUNDED: ['COMPLETED'],
      EXCHANGE_PENDING: ['EXCHANGE_PROCESSING'],
      EXCHANGE_PROCESSING: ['EXCHANGED'],
      EXCHANGED: ['COMPLETED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    return transitions[returnRequest.status as ReturnStatus]?.includes(next) ?? false;
  };

  const currentStatus = returnRequest.status as ReturnStatus;

  return (
    <>
      <AdminPageHeading
        eyebrow="Returns"
        title={`Return ${returnRequest.returnNumber}`}
        description={returnRequest.customerComments ?? undefined}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/returns"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-secondary hover:text-brand"
            >
              ← Back to returns
            </Link>
            <Link
              href={`/admin/orders/${returnRequest.orderId}`}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-secondary hover:text-brand"
            >
              View order
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <AdminPanel title="Customer">
            <div className="p-4 space-y-2">
              <p className="text-sm font-semibold text-ink-primary">
                {returnRequest.user.name ?? '—'}
              </p>
              <p className="text-xs text-ink-secondary">{returnRequest.user.email}</p>
            </div>
          </AdminPanel>

          <AdminPanel title="Original order">
            <div className="p-4 space-y-2">
              <p className="text-sm font-semibold text-ink-primary">
                {returnRequest.order.orderNumber}
              </p>
              <p className="text-xs text-ink-secondary">
                {formatDate(returnRequest.order.createdAt)} ·
                {returnRequest.order.paymentStatus} ·
                {returnRequest.order.payment?.provider || '—'}
              </p>
              <p className="text-sm font-bold text-ink-primary">
                {formatMoney(Number(returnRequest.order.total))}
              </p>
            </div>
          </AdminPanel>

          <AdminPanel title="Return items">
            <div className="p-4 space-y-3">
              {returnRequest.items.map((item) => (
                <div key={item.id} className="border-b border-line pb-2 last:border-b-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-primary">{item.productTitle}</span>
                    <span className="text-ink-secondary">
                      {item.variant?.size || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs text-ink-muted mt-1">
                    <span>Requested: {item.requestedQuantity}</span>
                    <span>Approved: {item.approvedQuantity}</span>
                    <span>Received: {item.receivedQuantity}</span>
                    <span>Accepted: {item.acceptedQuantity}</span>
                    <span>Rejected: {item.rejectedQuantity}</span>
                    {item.restockable && (
                      <span className="text-emerald-500">Restockable</span>
                    )}
                  </div>
                  {item.inspections.length > 0 && (
                    <div className="mt-2">
                      {item.inspections.map((inspection) => (
                        <div key={inspection.id} className="text-xs text-ink-secondary">
                          Inspected {formatDate(inspection.inspectedAt)} by{' '}
                          {inspection.inspector.name || inspection.inspector.email} —{' '}
                          {inspection.condition}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Timeline">
            <div className="p-4 space-y-4">
              {returnRequest.events.length === 0 ? (
                <EmptyState>No events recorded yet.</EmptyState>
              ) : (
                returnRequest.events.map((event) => (
                  <div key={event.id} className="border-l border-line pl-4">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {formatDate(event.createdAt)} · {event.source}
                    </p>
                    {event.description && (
                      <p className="mt-1 text-sm text-ink-secondary">
                        {event.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </AdminPanel>
        </div>

        <div className="lg:col-span-1">
          <AdminPanel title="Status">
            <div className="p-4">
              <span
                className={cn(
                  'inline-flex items-center border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] mb-2 block',
                  returnStatusStyles(currentStatus),
                )}
              >
                {RETURN_STATUS_LABELS[currentStatus]}
              </span>

              {canTransition('UNDER_REVIEW') && currentStatus !== 'UNDER_REVIEW' && (
                <form
                  action="/api/admin/returns/[returnId]/review"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <input name="action" type="hidden" value="review" />
                  <button
                    type="submit"
                    className="min-h-9 w-full border border-line px-3 font-mono text-[9px] font-bold uppercase text-ink-secondary hover:border-brand hover:text-ink-primary"
                  >
                    Mark under review
                  </button>
                </form>
              )}
              {canTransition('APPROVED') && (
                <form
                  action="/api/admin/returns/[returnId]/approve"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <textarea
                    name="reason"
                    rows={2}
                    placeholder="Approval reason (optional)"
                    className="mt-1 w-full border border-line bg-canvas px-2 py-1 text-[9px]"
                  />
                  <button
                    type="submit"
                    className="mt-2 min-h-9 w-full bg-emerald-500/10 border border-emerald-500/30 px-3 font-mono text-[9px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Approve
                  </button>
                </form>
              )}
              {canTransition('REJECTED') && (
                <form
                  action="/api/admin/returns/[returnId]/reject"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <textarea
                    name="reason"
                    rows={2}
                    placeholder="Rejection reason (required)"
                    className="mt-1 w-full border border-line bg-canvas px-2 py-1 text-[9px]"
                    required
                  />
                  <button
                    type="submit"
                    className="mt-2 min-h-9 w-full bg-brand/10 border border-brand/30 px-3 font-mono text-[9px] font-bold uppercase text-brand hover:bg-brand/20"
                  >
                    Reject
                  </button>
                </form>
              )}
              {canTransition('RETURN_RECEIVED') && (
                <form
                  action="/api/admin/returns/[returnId]/receive"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <input
                    name="receivedQuantity"
                    type="number"
                    min="0"
                    defaultValue="0"
                    className="mt-1 w-full border border-line bg-canvas px-2 py-1 text-[9px]"
                    required
                  />
                  <button
                    type="submit"
                    className="mt-2 min-h-9 w-full bg-cyan/10 border border-cyan/30 px-3 font-mono text-[9px] font-bold uppercase text-cyan hover:bg-cyan/20"
                  >
                    Mark received
                  </button>
                </form>
              )}
              {canTransition('INSPECTED') && (
                <form
                  action="/api/admin/returns/[returnId]/inspect"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <p className="text-[9px] text-ink-muted mb-1">
                    Inspection items must be submitted via the inspection panel.
                  </p>
                  <button
                    type="submit"
                    disabled
                    className="min-h-9 w-full border border-line px-3 font-mono text-[9px] font-bold uppercase text-ink-muted disabled:opacity-50"
                  >
                    Record inspection
                  </button>
                </form>
              )}
              {canTransition('REFUND_PROCESSING') && currentStatus === 'REFUND_PENDING' && (
                <form
                  action="/api/admin/returns/[returnId]/refund"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <textarea
                    name="reason"
                    rows={2}
                    placeholder="Refund reason (optional)"
                    className="mt-1 w-full border border-line bg-canvas px-2 py-1 text-[9px]"
                  />
                  <button
                    type="submit"
                    className="mt-2 min-h-9 w-full bg-emerald-500/10 border border-emerald-500/30 px-3 font-mono text-[9px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Initiate refund
                  </button>
                </form>
              )}
              {canTransition('EXCHANGE_PROCESSING') && currentStatus === 'EXCHANGE_PENDING' && (
                <form
                  action="/api/admin/returns/[returnId]/exchange"
                  method="POST"
                  className="mt-2"
                >
                  <input name="returnId" type="hidden" value={returnId} />
                  <button
                    type="submit"
                    className="min-h-9 w-full bg-cyan/10 border border-cyan/30 px-3 font-mono text-[9px] font-bold uppercase text-cyan hover:bg-cyan/20"
                  >
                    Approve exchange
                  </button>
                </form>
              )}
              {currentStatus === 'RETURN_SHIPPED' && (
                <div className="mt-2">
                  <p className="text-[9px] text-ink-muted mb-1">
                    Add carrier/tracking for the return shipment:
                  </p>
                  <form
                    action="/api/admin/returns/[returnId]/tracking"
                    method="POST"
                    className="space-y-2"
                  >
                    <input name="returnId" type="hidden" value={returnId} />
                    <input
                      name="carrier"
                      placeholder="Carrier (e.g. Royal Mail)"
                      className="w-full border border-line bg-canvas px-2 py-1 text-[9px]"
                    />
                    <input
                      name="trackingNumber"
                      placeholder="Tracking number"
                      className="w-full border border-line bg-canvas px-2 py-1 text-[9px]"
                    />
                    <button
                      type="submit"
                      className="min-h-9 w-full bg-cyan/10 border border-cyan/30 px-3 font-mono text-[9px] font-bold uppercase text-cyan hover:bg-cyan/20"
                    >
                      Save tracking
                    </button>
                  </form>
                </div>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>

      {returnRequest.shipment && (
        <AdminPanel title="Return shipment">
          <div className="p-4 space-y-2 text-sm">
            <p className="text-ink-secondary">
              {returnRequest.shipment.carrier || '—'} ·
              {returnRequest.shipment.trackingNumber || '—'}
            </p>
            {returnRequest.shipment.shippedAt && (
              <p className="text-ink-secondary">Shipped: {formatDate(returnRequest.shipment.shippedAt)}</p>
            )}
            {returnRequest.shipment.receivedAt && (
              <p className="text-ink-secondary">Received: {formatDate(returnRequest.shipment.receivedAt)}</p>
            )}
          </div>
        </AdminPanel>
      )}

      {returnRequest.exchangeRequest && (
        <AdminPanel title="Exchange">
          <div className="p-4 space-y-2 text-sm">
            <p className="text-ink-secondary">
              Status: {returnRequest.exchangeRequest.status}
            </p>
            <p className="text-ink-secondary">
              Replacement: {returnRequest.exchangeRequest.replacementQuantity} unit(s)
            </p>
          </div>
        </AdminPanel>
      )}

      {returnRequest.offlineRefund && (
        <AdminPanel title="Refund (offline)">
          <div className="p-4 space-y-2 text-sm">
            <p className="text-ink-secondary">
              Status: {returnRequest.offlineRefund.status}
            </p>
            <p className="text-ink-secondary">
              Amount: {formatMoney(Number(returnRequest.offlineRefund.amount))}
            </p>
            <p className="text-ink-secondary">
              Method: {returnRequest.offlineRefund.method}
            </p>
          </div>
        </AdminPanel>
      )}
    </>
  );
}

function returnStatusStyles(status: ReturnStatus): string {
  const base = 'inline-flex items-center border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]';
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
