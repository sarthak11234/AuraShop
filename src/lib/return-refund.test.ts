import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRefundableAmount } from './return-refund';
import { db } from './db';

async function findProductWithStock() {
  const product = await db.product.findFirst({
    where: { isPublished: true, archivedAt: null, variants: { some: { stock: { gte: 1 } } } },
    include: { variants: true },
  });
  if (!product) throw new Error('No product with stock available for testing');
  return product;
}

async function createCapturedOrder(userId: string) {
  return db.order.create({
    data: {
      orderNumber: `VEXO-REFUND-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId,
      status: 'DELIVERED',
      paymentStatus: 'paid',
      subtotal: 100,
      discount: 10,
      shipping: 10,
      tax: 5,
      total: 105,
      currency: 'USD',
      shippedAt: new Date(),
    },
  });
}

async function createOrderItemWithPrice(orderId: string, productId: string, variantId: string | null, quantity: number, price: number) {
  return db.orderItem.create({
    data: {
      orderId,
      productId,
      productTitle: 'Refund Test Product',
      productSlug: 'refund-test-product',
      variantId,
      size: 'M',
      quantity,
      price,
      lineTotal: price * quantity,
    },
  });
}

async function createPayment(orderId: string) {
  return db.payment.create({
    data: {
      orderId,
      provider: 'razorpay',
      providerPaymentId: `pay_${Math.random().toString(36).slice(2, 8)}`,
      providerOrderId: `order_${Math.random().toString(36).slice(2, 8)}`,
      amount: 105,
      currency: 'USD',
      status: 'captured',
      method: 'Razorpay',
      capturedAt: new Date(),
    },
  });
}

async function createReturnRequest(orderId: string, userId: string, productId: string, variantId: string | null, items: Array<{ orderItemId: number; approvedQuantity: number; price: number }>) {
  return db.returnRequest.create({
    data: {
      returnNumber: `VEXO-RET-REFUND${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      userId,
      orderId,
      status: 'INSPECTED',
      returnReason: 'DAMAGED',
      returnType: 'REFUND',
      requestedAt: new Date(),
      items: {
        create: items.map((item) => ({
          orderItem: { connect: { id: item.orderItemId } },
          product: { connect: { id: productId } },
          ...(variantId ? { variant: { connect: { id: variantId } } } : {}),
          productTitle: 'Refund Test Product',
          productSlug: 'refund-test-product',
          size: 'M',
          requestedQuantity: item.approvedQuantity,
          approvedQuantity: item.approvedQuantity,
          price: item.price,
          lineTotal: item.price * item.approvedQuantity,
        })),
      },
    },
  });
}

test('calculates refundable amount from approved items only', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `refund-test-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Refund User' },
  });
  const order = await createCapturedOrder(user.id);
  await createPayment(order.id);
  const orderItem = await createOrderItemWithPrice(order.id, product.id, variant.id, 2, 50);

  const returnRequest = await createReturnRequest(order.id, user.id, product.id, variant.id, [
    { orderItemId: orderItem.id, approvedQuantity: 1, price: 50 },
  ]);

  const calculation = await calculateRefundableAmount({ returnRequestId: returnRequest.id });
  // $50 item - $5 proportional discount + $5 proportional shipping + $2.50 proportional tax = $52.50
  assert.equal(calculation.refundableCents, 5250);
  assert.equal(calculation.alreadyRefundedCents, 0);
  assert.equal(calculation.remainingCents, 5250);

  await db.returnRequest.delete({ where: { id: returnRequest.id } });
  await db.payment.delete({ where: { orderId: order.id } });
  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('prevents refunds exceeding the refundable balance', async () => {
  const product = await findProductWithStock();
  const variant = product.variants[0];
  const user = await db.user.create({
    data: { email: `refund-test-${Math.random().toString(36).slice(2)}@test.vexo.store`, name: 'Refund User' },
  });
  const order = await createCapturedOrder(user.id);
  await createPayment(order.id);
  const orderItem = await createOrderItemWithPrice(order.id, product.id, variant.id, 2, 50);

  const returnRequest = await createReturnRequest(order.id, user.id, product.id, variant.id, [
    { orderItemId: orderItem.id, approvedQuantity: 1, price: 50 },
  ]);

  const payment = await db.payment.findUnique({ where: { orderId: order.id } });
  await db.refund.create({
    data: {
      paymentId: payment!.id,
      orderId: order.id,
      amount: 50,
      currency: 'USD',
      status: 'COMPLETED',
      providerRefundId: `ref_${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  const calculation = await calculateRefundableAmount({ returnRequestId: returnRequest.id });
  // $52.50 refundable - $50 already refunded = $2.50 remaining
  assert.equal(calculation.remainingCents, 250);

  await db.refund.deleteMany({ where: { orderId: order.id } });
  await db.returnRequest.delete({ where: { id: returnRequest.id } });
  await db.payment.delete({ where: { orderId: order.id } });
  await db.orderItem.delete({ where: { id: orderItem.id } });
  await db.order.delete({ where: { id: order.id } });
  await db.user.delete({ where: { id: user.id } });
});

test('throws when return request not found', async () => {
  await assert.rejects(
    calculateRefundableAmount({ returnRequestId: 'nonexistent' }),
    (err: Error) => err.message.includes('not found')
  );
});
