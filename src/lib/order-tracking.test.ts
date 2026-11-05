import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { parseTrackingMetadata, upsertOrderTrackingEvent } from './order-tracking';

test('parses verified manual shipment metadata', () => {
  const result = parseTrackingMetadata({
    carrier: '  Royal Mail ',
    trackingNumber: ' RM123456789GB ',
    trackingUrl: 'https://track.example.test/RM123456789GB',
    location: 'London',
    description: 'Handed to the carrier',
    shippedAt: '2026-11-03T10:00:00.000Z',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.carrier, 'Royal Mail');
  assert.equal(result.data.trackingNumber, 'RM123456789GB');
  assert.equal(result.data.trackingUrl, 'https://track.example.test/RM123456789GB');
  assert.equal(result.data.location, 'London');
  assert.equal(result.data.description, 'Handed to the carrier');
  assert.equal(result.data.shippedAt?.toISOString(), '2026-11-03T10:00:00.000Z');
});

test('supports clearing optional shipment fields explicitly', () => {
  const result = parseTrackingMetadata({
    carrier: null,
    trackingNumber: '',
    trackingUrl: null,
    location: '',
    description: '',
    shippedAt: null,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data, {
    carrier: null,
    trackingNumber: null,
    trackingUrl: null,
    location: null,
    description: null,
    shippedAt: null,
  });
});

test('returns an empty metadata object when no fields are supplied', () => {
  assert.deepEqual(parseTrackingMetadata({}), { ok: true, data: {} });
});

test('rejects invalid shipment metadata', () => {
  assert.equal(parseTrackingMetadata(null).ok, false);
  assert.equal(parseTrackingMetadata({ carrier: 42 }).ok, false);
  assert.equal(parseTrackingMetadata({ carrier: 'x'.repeat(81) }).ok, false);
  assert.equal(parseTrackingMetadata({ trackingNumber: 'ABC$123' }).ok, false);
  assert.equal(parseTrackingMetadata({ trackingNumber: 'x'.repeat(101) }).ok, false);
  assert.equal(parseTrackingMetadata({ trackingUrl: 'ftp://example.test/track' }).ok, false);
  assert.equal(parseTrackingMetadata({ trackingUrl: 'not-a-url' }).ok, false);
  assert.equal(parseTrackingMetadata({ location: 'x'.repeat(121) }).ok, false);
  assert.equal(parseTrackingMetadata({ description: 'x'.repeat(501) }).ok, false);
  assert.equal(parseTrackingMetadata({ shippedAt: 'not-a-date' }).ok, false);
  assert.equal(parseTrackingMetadata({ shippedAt: 123 }).ok, false);
  assert.equal(
    parseTrackingMetadata({ shippedAt: new Date(Date.now() + 60 * 60_000).toISOString() }).ok,
    false,
  );
});

test('upserts tracking events by order and status so repeats stay idempotent', async () => {
  type StoredEvent = {
    id: number;
    orderId: string;
    status: string;
    title: string;
    description: string | null;
    location: string | null;
    source: string;
    carrier: string | null;
    trackingNumber: string | null;
    createdBy: string | null;
  };

  const stored: StoredEvent[] = [];
  let nextId = 1;

  const tx = {
    orderTrackingEvent: {
      async upsert({ where, update, create }: Prisma.OrderTrackingEventUpsertArgs) {
        const key = where.orderId_status!;
        const existing = stored.find(
          (event) => event.orderId === key.orderId && event.status === key.status,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const event: StoredEvent = {
          id: nextId++,
          orderId: create.orderId as string,
          status: create.status as string,
          title: create.title as string,
          description: (create.description as string | null) ?? null,
          location: (create.location as string | null) ?? null,
          source: create.source as string,
          carrier: (create.carrier as string | null) ?? null,
          trackingNumber: (create.trackingNumber as string | null) ?? null,
          createdBy: (create.createdBy as string | null) ?? null,
        };
        stored.push(event);
        return event;
      },
    },
  };

  await upsertOrderTrackingEvent(tx as unknown as Prisma.TransactionClient, {
    orderId: 'order-1',
    status: 'PACKED',
    source: 'ADMIN',
    createdBy: 'admin-1',
  });
  await upsertOrderTrackingEvent(tx as unknown as Prisma.TransactionClient, {
    orderId: 'order-1',
    status: 'PACKED',
    source: 'ADMIN',
    createdBy: 'admin-1',
    description: 'Packed for dispatch',
    location: 'London',
  });

  assert.equal(stored.length, 1);
  assert.equal(stored[0].title, 'Order packed');
  assert.equal(stored[0].description, 'Packed for dispatch');
  assert.equal(stored[0].location, 'London');
  assert.equal(stored[0].source, 'ADMIN');

  await upsertOrderTrackingEvent(tx as unknown as Prisma.TransactionClient, {
    orderId: 'order-1',
    status: 'SHIPPED',
    source: 'ADMIN',
    carrier: 'Royal Mail',
    trackingNumber: 'RM123456789GB',
  });
  assert.equal(stored.length, 2);
  assert.equal(stored[1].title, 'Order shipped');
  assert.equal(stored[1].carrier, 'Royal Mail');
  assert.equal(stored[1].trackingNumber, 'RM123456789GB');
});
