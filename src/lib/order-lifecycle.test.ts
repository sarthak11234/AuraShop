import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTrackingTimeline,
  getCancellationEligibility,
  orderStatusLabel,
  trackingEventTitle,
  type CancellationEligibilityInput,
} from './order-lifecycle';

const baseInput: CancellationEligibilityInput = {
  status: 'CONFIRMED',
  cancelledAt: null,
  paymentStatus: 'pending',
  inventoryReservedAt: new Date('2026-11-01T10:00:00.000Z'),
  payment: { provider: 'cod', status: 'pending', providerOrderId: null },
};

test('labels every order status including new fulfilment states', () => {
  assert.equal(orderStatusLabel('PACKED'), 'Packed');
  assert.equal(orderStatusLabel('FAILED_DELIVERY'), 'Delivery failed');
  assert.equal(orderStatusLabel('OUT_FOR_DELIVERY'), 'Out for delivery');
  assert.equal(trackingEventTitle('PACKED'), 'Order packed');
  assert.equal(trackingEventTitle('FAILED_DELIVERY'), 'Delivery attempt failed');
});

test('allows COD cancellation before shipment when inventory is reserved', () => {
  assert.deepEqual(getCancellationEligibility(baseInput), {
    eligible: true,
    alreadyCancelled: false,
    code: 'ELIGIBLE',
    reason: 'This order can be cancelled and the reserved stock will be returned to the catalogue.',
  });
});

test('blocks COD cancellation when the inventory reservation is unknown', () => {
  const result = getCancellationEligibility({ ...baseInput, inventoryReservedAt: null });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'INVENTORY_STATE_UNAVAILABLE');
});

test('reports already-cancelled orders consistently', () => {
  assert.equal(
    getCancellationEligibility({ ...baseInput, status: 'CANCELLED' }).alreadyCancelled,
    true,
  );
  const cancelledAt = getCancellationEligibility({
    ...baseInput,
    cancelledAt: new Date('2026-11-02T10:00:00.000Z'),
  });
  assert.equal(cancelledAt.eligible, false);
  assert.equal(cancelledAt.code, 'ALREADY_CANCELLED');
});

test('never offers cancellation after shipment or delivery', () => {
  for (const status of ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED'] as const) {
    const result = getCancellationEligibility({ ...baseInput, status });
    assert.equal(result.eligible, false, status);
    assert.equal(result.code, 'NOT_CANCELLABLE', status);
  }
});

test('blocks cancellation when a payment has actually been collected', () => {
  const captured = getCancellationEligibility({
    ...baseInput,
    paymentStatus: 'paid',
    payment: { provider: 'razorpay', status: 'captured', providerOrderId: 'order_123' },
  });
  assert.equal(captured.eligible, false);
  assert.equal(captured.code, 'PAID_ONLINE');

  const verified = getCancellationEligibility({
    ...baseInput,
    payment: { provider: 'razorpay', status: 'verified', providerOrderId: 'order_123' },
  });
  assert.equal(verified.eligible, false);
  assert.equal(verified.code, 'PAID_ONLINE');

  const paidCod = getCancellationEligibility({
    ...baseInput,
    paymentStatus: 'paid',
    inventoryReservedAt: new Date(),
  });
  assert.equal(paidCod.eligible, false);
  assert.equal(paidCod.code, 'PAID_ONLINE');
});

test('blocks cancellation while an online payment attempt is still open', () => {
  const result = getCancellationEligibility({
    ...baseInput,
    inventoryReservedAt: null,
    payment: { provider: 'razorpay', status: 'pending', providerOrderId: 'order_open' },
  });
  assert.equal(result.eligible, false);
  assert.equal(result.code, 'PAYMENT_IN_PROGRESS');
});

test('allows cancelling an unpaid online order with no provider attempt', () => {
  const result = getCancellationEligibility({
    ...baseInput,
    inventoryReservedAt: null,
    payment: { provider: 'razorpay', status: 'pending', providerOrderId: null },
  });
  assert.equal(result.eligible, true);
  assert.equal(result.code, 'ELIGIBLE');
});

test('fails closed when payment state is missing or unsupported', () => {
  const missing = getCancellationEligibility({ ...baseInput, payment: null });
  assert.equal(missing.eligible, false);
  assert.equal(missing.code, 'PAYMENT_STATE_UNAVAILABLE');

  const unsupported = getCancellationEligibility({
    ...baseInput,
    payment: { provider: 'bank-transfer', status: 'pending', providerOrderId: null },
  });
  assert.equal(unsupported.eligible, false);
  assert.equal(unsupported.code, 'PAYMENT_STATE_UNAVAILABLE');
});

test('derives an order-placed timeline entry only from the persisted creation time', () => {
  const createdAt = '2026-11-01T10:00:00.000Z';
  const timeline = buildTrackingTimeline({
    createdAt,
    orderNumber: 'VEXO-TEST',
    events: [],
  });
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].status, 'ORDER_PLACED');
  assert.equal(timeline[0].derived, true);
  assert.equal(timeline[0].occurredAt, createdAt);
  assert.match(timeline[0].description ?? '', /VEXO-TEST/);
});

test('uses persisted events in chronological order and does not invent shipments', () => {
  const timeline = buildTrackingTimeline({
    createdAt: '2026-11-01T10:00:00.000Z',
    orderNumber: 'VEXO-TEST',
    events: [
      {
        id: 2,
        status: 'PACKED',
        title: 'Order packed',
        description: null,
        location: null,
        source: 'ADMIN',
        carrier: null,
        trackingNumber: null,
        createdAt: '2026-11-03T10:00:00.000Z',
      },
      {
        id: 1,
        status: 'CONFIRMED',
        title: '',
        description: 'Confirmed by support',
        location: 'London',
        source: 'ADMIN',
        carrier: null,
        trackingNumber: null,
        createdAt: '2026-11-02T10:00:00.000Z',
      },
    ],
  });

  assert.deepEqual(
    timeline.map((entry) => entry.status),
    ['ORDER_PLACED', 'CONFIRMED', 'PACKED'],
  );
  assert.equal(timeline[1].title, 'Order confirmed');
  assert.equal(timeline[1].location, 'London');
  assert.equal(timeline[2].derived, false);
  // No fabricated shipped/delivered entries.
  assert.equal(timeline.some((entry) => entry.status === 'SHIPPED'), false);
  assert.equal(
    timeline.some((entry) => JSON.stringify(entry).toLowerCase().includes('estimated')),
    false,
  );
});

test('does not duplicate order-placed when a persisted pending event exists', () => {
  const timeline = buildTrackingTimeline({
    createdAt: '2026-11-01T10:00:00.000Z',
    orderNumber: 'VEXO-TEST',
    events: [
      {
        id: 7,
        status: 'PENDING',
        title: 'Order placed',
        description: 'Checkout completed',
        location: null,
        source: 'SYSTEM',
        carrier: null,
        trackingNumber: null,
        createdAt: '2026-11-01T10:00:00.000Z',
      },
    ],
  });
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].derived, false);
  assert.equal(timeline[0].status, 'PENDING');
});
