import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReturnEligibility } from './return-policy';
import { db } from './db';

async function findProductWithStock() {
  const product = await db.product.findFirst({
    where: { isPublished: true, archivedAt: null, variants: { some: { stock: { gte: 1 } } } },
    include: { variants: true },
  });
  if (!product) throw new Error('No product with stock available for testing');
  return product;
}

async function createDeliveredOrder(userId: string) {
  return db.order.create({
    data: {
      orderNumber: `VEXO-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId,
      status: 'DELIVERED',
      paymentStatus: 'paid',
      subtotal: 100,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 100,
      currency: 'USD',
      shippedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
  });
}

async function createOrderItem(orderId: string, productId: string, variantId: string | null, quantity: number, price: number) {
  return db.orderItem.create({
    data: {
      orderId,
      productId,
      productTitle: 'Test Product',
      productSlug: 'test-product',
      variantId,
      size: 'M',
      quantity,
      price,
      lineTotal: price * quantity,
    },
  });
}

test('evaluates a delivered order as eligible for return', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `return-policy-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Test User' },
  });
  const order = await createDeliveredOrder(user.id);
  const orderItem = await createOrderItem(order.id, product.id, variant.id, 2, 50);

  const result = await evaluateReturnEligibility({ orderId: order.id, userId: user.id });
  assert.equal(result.eligible, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].eligibility.eligible, true);
  assert.equal(result.items[0].eligibility.maxReturnableQuantity, 2);

  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('rejects return for non-delivered order', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `return-policy-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Test User' },
  });
  const order = await db.order.create({
    data: {
      orderNumber: `VEXO-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      status: 'SHIPPED',
      paymentStatus: 'pending',
      subtotal: 100,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 100,
      currency: 'USD',
      createdAt: new Date(),
    },
  });
  const orderItem = await createOrderItem(order.id, product.id, variant.id, 1, 50);

  const result = await evaluateReturnEligibility({ orderId: order.id, userId: user.id });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.some((r) => r.includes('not available')), true);

  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('rejects return for order outside the return window', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `return-policy-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Test User' },
  });
  const order = await db.order.create({
    data: {
      orderNumber: `VEXO-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      status: 'DELIVERED',
      paymentStatus: 'paid',
      subtotal: 100,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 100,
      currency: 'USD',
      shippedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000),
    },
  });
  const orderItem = await createOrderItem(order.id, product.id, variant.id, 1, 50);

  const result = await evaluateReturnEligibility({ orderId: order.id, userId: user.id });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.some((r) => r.includes('window')), true);

  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('rejects duplicate return requests for the same order', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `return-policy-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Test User' },
  });
  const order = await createDeliveredOrder(user.id);
  await createOrderItem(order.id, product.id, variant.id, 1, 50);

  await db.returnRequest.create({
    data: {
      returnNumber: `VEXO-RET-EXISTING${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      orderId: order.id,
      status: 'REQUESTED',
      returnReason: 'WRONG_SIZE',
      returnType: 'REFUND',
      requestedAt: new Date(),
    },
  });

  const result = await evaluateReturnEligibility({ orderId: order.id, userId: user.id });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.some((r) => r.includes('active return')), true);

  await db.returnRequest.deleteMany({ where: { orderId: order.id } });
  await db.orderItem.deleteMany({ where: { orderId: order.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('rejects return for cancelled order', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `return-policy-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Test User' },
  });
  const order = await db.order.create({
    data: {
      orderNumber: `VEXO-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      status: 'CANCELLED',
      paymentStatus: 'cancelled',
      subtotal: 100,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 100,
      currency: 'USD',
      createdAt: new Date(),
    },
  });
  const orderItem = await createOrderItem(order.id, product.id, variant.id, 1, 50);

  const result = await evaluateReturnEligibility({ orderId: order.id, userId: user.id });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons.some((r) => r.toLowerCase().includes('cancelled')), true);

  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('calculates max returnable quantity excluding already returned items', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `return-policy-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Test User' },
  });
  const order = await createDeliveredOrder(user.id);
  const orderItem = await createOrderItem(order.id, product.id, variant.id, 5, 50);

  await db.returnRequest.create({
    data: {
      returnNumber: `VEXO-RET-EXISTING${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId: user.id,
      orderId: order.id,
      status: 'COMPLETED',
      returnReason: 'WRONG_SIZE',
      returnType: 'REFUND',
      requestedAt: new Date(),
      items: {
        create: {
          orderItem: { connect: { id: orderItem.id } },
          product: { connect: { id: product.id } },
          ...(variant.id ? { variant: { connect: { id: variant.id } } } : {}),
          productTitle: 'Test Product',
          productSlug: product.slug,
          size: 'M',
          requestedQuantity: 2,
          approvedQuantity: 2,
          price: 50,
          lineTotal: 100,
        },
      },
    },
  });

  const result = await evaluateReturnEligibility({ orderId: order.id, userId: user.id });
  assert.equal(result.eligible, true);
  assert.equal(result.items[0].alreadyReturnedQuantity, 2);
  assert.equal(result.items[0].eligibility.maxReturnableQuantity, 3);

  await db.returnItem.deleteMany({ where: { orderItemId: orderItem.id } });
  await db.returnRequest.deleteMany({ where: { orderId: order.id } });
  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});
