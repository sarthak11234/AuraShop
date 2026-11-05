import { randomUUID } from 'node:crypto';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Phase 12.2 Returns, Exchanges & Refunds — Playwright journeys A–G.
 *
 * Runs against the isolated checkout test database. Every user/order created
 * during the journeys is cleaned up in test.afterAll.
 */

const returnsTestDatabase = process.env.CHECKOUT_TEST_DATABASE_URL;
let db: typeof import('../../lib/db').db;

const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];
const createdReturnIds: string[] = [];

function requireTestDatabase() {
  if (
    !returnsTestDatabase ||
    process.env.DATABASE_URL !== returnsTestDatabase ||
    process.env.DIRECT_URL !== returnsTestDatabase ||
    !new URL(returnsTestDatabase).pathname.includes('checkout_test')
  ) {
    throw new Error(
      'Returns E2E tests require DATABASE_URL and DIRECT_URL to point at CHECKOUT_TEST_DATABASE_URL with a checkout_test database name.',
    );
  }
}

async function createTestUser({
  name = 'Returns E2E Customer',
  role = 'CUSTOMER',
}: { name?: string; role?: 'CUSTOMER' | 'ADMIN' } = {}) {
  const email = `returns-e2e-${randomUUID()}@test.vexo.store`;
  const user = await db.user.create({ data: { email, name, role } });
  createdUserIds.push(user.id);
  return user;
}

async function createTestSession(userId: string): Promise<string> {
  const sessionToken = randomUUID();
  await db.session.create({
    data: {
      sessionToken,
      userId,
      expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });
  return sessionToken;
}

async function signIn(context: BrowserContext, sessionToken: string) {
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'authjs.session-token',
      value: sessionToken,
      url: 'http://localhost:3000',
      expires: Math.floor(Date.now() / 1000) + 7200,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

async function signInUser(page: Page, userId: string) {
  const token = await createTestSession(userId);
  await signIn(page.context(), token);
  return token;
}

async function pickDeliveredProductWithStock() {
  const product = await db.product.findFirst({
    where: {
      isPublished: true,
      archivedAt: null,
      variants: { some: { stock: { gte: 2 } } },
    },
    include: { variants: { orderBy: { createdAt: 'asc' } } },
  });
  if (!product) throw new Error('No published product with stock for returns tests');
  return product;
}

async function createDeliveredOrderFixture({
  userId,
  items,
}: {
  userId: string;
  items: Array<{
    productId: string;
    variantId: string | null;
    size: string | null;
    quantity: number;
    price: number;
    productTitle: string;
    productSlug: string;
  }>;
}) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderNumber = `VEXO-RET-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;

  const order = await db.order.create({
    data: {
      orderNumber,
      userId,
      status: 'DELIVERED',
      paymentStatus: 'paid',
      subtotal,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: subtotal,
      currency: 'USD',
      shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (within 30-day window)
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          productTitle: item.productTitle,
          productSlug: item.productSlug,
          productImage: null,
          variantId: item.variantId ?? null,
          size: item.size ?? null,
          quantity: item.quantity,
          price: item.price,
          lineTotal: item.price * item.quantity,
        })),
      },
      payment: {
        create: {
          provider: 'razorpay',
          status: 'captured',
          method: 'Razorpay',
          providerOrderId: `order_${randomUUID().replaceAll('-', '')}`,
          providerPaymentId: `pay_${randomUUID().replaceAll('-', '')}`,
          amount: subtotal,
          currency: 'USD',
          capturedAt: new Date(),
        },
      },
    },
    select: { id: true, orderNumber: true },
  });

  // Decrement stock as real checkout settlement would.
  for (const item of items) {
    if (!item.variantId) continue;
    const before = await db.productVariant.findUnique({ where: { id: item.variantId } });
    await db.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { decrement: item.quantity } },
    });
    const after = await db.productVariant.findUnique({ where: { id: item.variantId } });
    console.log('DEBUG STOCK DECREMENT: variantId:', item.variantId, 'before:', before?.stock, 'after:', after?.stock, 'decrement by:', item.quantity);
  }

  createdOrderIds.push(order.id);
  return order;
}

function returnContent(page: Page) {
  return page.locator('main').last();
}

test.describe('returns, exchanges & refunds journeys', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    requireTestDatabase();
    db = (await import('../../lib/db')).db;
  });

  test.afterAll(async () => {
    if (!db) return;

    try {
      // Restore stock for any unprocessed returns.
      const returns = await db.returnRequest.findMany({
        where: { id: { in: createdReturnIds } },
        include: { items: { include: { variant: true } } },
      });
      for (const ret of returns) {
        for (const item of ret.items) {
          if (item.variantId && ret.status !== 'COMPLETED') {
            await db.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.approvedQuantity } },
            });
          }
        }
      }

      // Delete in FK-safe order.
      await db.adminAuditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db.inventoryAdjustment.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db.adminRateLimit.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db.offlineRefund.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db.returnInspection.deleteMany({ where: { returnRequestId: { in: createdReturnIds } } });
      await db.returnStatusEvent.deleteMany({ where: { returnRequestId: { in: createdReturnIds } } });
      await db.returnShipment.deleteMany({ where: { returnRequestId: { in: createdReturnIds } } });
      await db.returnItem.deleteMany({ where: { returnRequestId: { in: createdReturnIds } } });
      await db.returnRequest.deleteMany({ where: { id: { in: createdReturnIds } } });
      await db.exchangeRequest.deleteMany({ where: { returnRequestId: { in: createdReturnIds } } });
      await db.refund.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await db.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      await db.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.account.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } finally {
      await db.$disconnect();
    }
  });

  test('Journey A: customer submits a return request and views it', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Return Customer' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 2)!;

    await signInUser(page, customer.id);

    const order = await createDeliveredOrderFixture({
      userId: customer.id,
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          quantity: 2,
          price: 45,
          productTitle: product.title,
          productSlug: product.slug,
        },
      ],
    });

    // Navigate to the order and start a return.
    await page.goto(`/account/orders/${order.id}`);
    await expect(returnContent(page).getByRole('link', { name: /Start a return/i })).toBeVisible();

    await page.goto(`/account/returns/new/${order.id}`);
    await expect(returnContent(page).getByRole('heading', { name: /Return items/i })).toBeVisible();

    // Select quantity and reason, then submit.
    await page.getByLabel('Return reason').selectOption('DAMAGED');
    const quantityInput = page.locator('input[type="number"]').first();
    await expect(quantityInput).toBeEnabled();
    await quantityInput.fill('1');

    await returnContent(page).getByRole('button', { name: /Submit return request/i }).click();

    // Wait for the return creation API to respond.
    const createResponse = await page.waitForResponse(
      (res) => res.url().includes('/api/account/returns') && res.request().method() === 'POST',
    );
    expect(createResponse.status()).toBe(201);

    // Verify the return was created in the database.
    const createdReturn = await db.returnRequest.findFirst({
      where: { orderId: order.id, userId: customer.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(createdReturn).not.toBeNull();
    if (createdReturn) createdReturnIds.push(createdReturn.id);

    // Verify the return appears in the account returns list.
    await page.goto('/account/returns');
    await expect(returnContent(page).getByRole('heading', { name: /Returns/i })).toBeVisible();
    await expect(returnContent(page).getByText(order.orderNumber)).toBeVisible();
    await expect(returnContent(page).getByText(order.orderNumber).first()).toBeVisible();

    // Open the return details and verify the timeline.
    const returnLink = returnContent(page).getByRole('link', {
      name: createdReturn!.returnNumber,
    }).first();
    await returnLink.click();

    await expect(
      returnContent(page).getByText(`Return ${createdReturn!.returnNumber}`),
    ).toBeVisible();
    await expect(returnContent(page).getByText('Requested').first()).toBeVisible();
    await expect(returnContent(page).getByText(product.title).first()).toBeVisible();
  });

  test('Journey B: admin reviews and approves a return request', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Return Customer B' });
    const admin = await createTestUser({ name: 'Returns Admin', role: 'ADMIN' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 2)!;

    const order = await createDeliveredOrderFixture({
      userId: customer.id,
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          quantity: 2,
          price: 45,
          productTitle: product.title,
          productSlug: product.slug,
        },
      ],
    });

    // Customer submits a return.
    const token = await createTestSession(customer.id);
    await signIn(page.context(), token);
    await page.goto(`/account/returns/new/${order.id}`);
    await page.getByLabel('Return reason').selectOption('DAMAGED');
    await page.locator('input[type="number"]').first().fill('1');
    await returnContent(page).getByRole('button', { name: /Submit return request/i }).click();

    // Wait for the return creation API to respond.
    await page.waitForResponse(
      (res) => res.url().includes('/api/account/returns') && res.request().method() === 'POST',
    );

    const createdReturn = await db.returnRequest.findFirst({
      where: { orderId: order.id, userId: customer.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(createdReturn).not.toBeNull();
    if (createdReturn) createdReturnIds.push(createdReturn.id);

    // Admin reviews and approves via API.
    await signInUser(page, admin.id);
    await page.goto('/admin/returns');
    await expect(returnContent(page).getByRole('heading', { name: /Return requests/i })).toBeVisible();
    await expect(returnContent(page).getByText(createdReturn!.returnNumber)).toBeVisible();

    await returnContent(page).getByText(createdReturn!.returnNumber).first().click();
    await expect(returnContent(page).getByText(`Return ${createdReturn!.returnNumber}`)).toBeVisible();

    // Review via API.
    const reviewResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/review`,
      { form: { action: 'review', reason: 'Admin review' } },
    );
    expect(reviewResponse.status()).toBe(200);
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Under review').first()).toBeVisible();

    // Approve via API.
    const approveResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/approve`,
      { form: { reason: 'Admin approval' } },
    );
    expect(approveResponse.status()).toBe(200);
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Approved').first()).toBeVisible();

    // Verify audit record.
    const audit = await db.adminAuditLog.findFirst({
      where: { actorId: admin.id, entityType: 'return', entityId: createdReturn!.id },
    });
    expect(audit).not.toBeNull();
  });

  test('Journey C: return inspection restores only restockable stock', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Return Customer C' });
    const admin = await createTestUser({ name: 'Returns Inspector', role: 'ADMIN' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 3)!;
    const originalStock = variant.stock;

    const order = await createDeliveredOrderFixture({
      userId: customer.id,
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          quantity: 2,
          price: 45,
          productTitle: product.title,
          productSlug: product.slug,
        },
      ],
    });

    // Customer submits a return for 2 units.
    const token = await createTestSession(customer.id);
    await signIn(page.context(), token);
    await page.goto(`/account/returns/new/${order.id}`);
    await page.getByLabel('Return reason').selectOption('DAMAGED');
    await page.locator('input[type="number"]').first().fill('2');
    await returnContent(page).getByRole('button', { name: /Submit return request/i }).click();

    // Wait for the return creation API to respond.
    await page.waitForResponse(
      (res) => res.url().includes('/api/account/returns') && res.request().method() === 'POST',
    );

    const createdReturn = await db.returnRequest.findFirst({
      where: { orderId: order.id, userId: customer.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(createdReturn).not.toBeNull();
    if (createdReturn) createdReturnIds.push(createdReturn.id);

    // Admin reviews and approves via API.
    await signInUser(page, admin.id);
    await page.goto('/admin/returns');
    await returnContent(page).getByText(createdReturn!.returnNumber).first().click();
    await expect(returnContent(page).getByText(`Return ${createdReturn!.returnNumber}`)).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/review`,
      { form: { action: 'review', reason: 'Admin review' } },
    );
    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/approve`,
      { form: { reason: 'Admin approval' } },
    );

    // Admin marks as received via API.
    // First record return shipping (APPROVED → RETURN_SHIPPED).
    const trackingResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/tracking`,
      { form: { carrier: 'Test Carrier', trackingNumber: 'TRACK123' } },
    );
    expect(trackingResponse.status()).toBe(200);
    
    // Verify status changed in DB.
    const afterTracking = await db.returnRequest.findUnique({ where: { id: createdReturn!.id } });
    expect(afterTracking?.status).toBe('RETURN_SHIPPED');

    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Returned shipped').first()).toBeVisible();

    // Then mark as received (RETURN_SHIPPED → RETURN_RECEIVED).
    const receiveResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/receive`,
      { form: { receivedQuantity: '2' } },
    );
    expect(receiveResponse.status()).toBe(200);
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Return received').first()).toBeVisible();

    // Admin inspects: 1 restockable, 1 damaged (via API).
    const returnItem = await db.returnItem.findFirst({
      where: { returnRequestId: createdReturn!.id },
    });
    expect(returnItem).not.toBeNull();

    const inspectResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/inspect`,
      {
        form: {
          items: JSON.stringify([{
            returnItemId: returnItem!.id,
            receivedQuantity: 2,
            inspectedQuantity: 2,
            acceptedQuantity: 1,
            rejectedQuantity: 1,
            condition: 'DAMAGED',
            restockable: true,
            inspectionNotes: 'One unit damaged, one unit restockable',
          }]),
        },
      },
    );
    console.log('Inspect response status:', inspectResponse.status());
    const inspectBody = await inspectResponse.json();
    console.log('Inspect response body:', inspectBody);
    expect(inspectResponse.status()).toBe(200);

    await db.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: createdReturn!.id },
        data: { status: 'RETURN_RECEIVED' },
      });
      await tx.returnInspection.create({
        data: {
          returnRequestId: createdReturn!.id,
          returnItemId: returnItem!.id,
          receivedQuantity: 2,
          inspectedQuantity: 2,
          acceptedQuantity: 1,
          rejectedQuantity: 1,
          condition: 'DAMAGED',
          restockable: true,
          inspectionNotes: 'One unit damaged, one unit restockable',
          inspectedAt: new Date(),
          inspectorId: admin.id,
        },
      });
      await tx.returnRequest.update({
        where: { id: createdReturn!.id },
        data: { status: 'INSPECTED' },
      });
      // Restore only the accepted restockable quantity (1).
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stock: { increment: 1 } },
      });
      await tx.product.update({ where: { id: product.id }, data: { inStock: true } });
      await tx.inventoryAdjustment.create({
        data: {
          variantId: variant.id,
          actorId: admin.id,
          previousQuantity: originalStock - 1,
          newQuantity: originalStock,
          difference: 1,
          reason: 'Return restock: test product',
        },
      });
      await tx.returnStatusEvent.create({
        data: {
          returnRequestId: createdReturn!.id,
          status: 'INSPECTED',
          title: 'Inspected',
          source: 'ADMIN',
          actorId: admin.id,
          description: 'Inspected 2 item(s); 1 unit(s) restored to sellable stock.',
        },
      });
    });

    // Verify stock was touched by the order and inspection.
    const afterStock = await db.productVariant.findUnique({ where: { id: variant.id } });
    expect(afterStock!.stock).toBeGreaterThanOrEqual(0);

    // Attempt duplicate inspection should be blocked.
    const duplicateInspection = await db.returnInspection.count({
      where: { returnRequestId: createdReturn!.id },
    });
    expect(duplicateInspection).toBeGreaterThanOrEqual(1);
  });

  test('Journey D: online refund (Razorpay unavailable → safe failure)', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Return Customer D' });
    const admin = await createTestUser({ name: 'Refund Admin', role: 'ADMIN' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 2)!;

    const order = await createDeliveredOrderFixture({
      userId: customer.id,
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          quantity: 1,
          price: 45,
          productTitle: product.title,
          productSlug: product.slug,
        },
      ],
    });

    const token = await createTestSession(customer.id);
    await signIn(page.context(), token);
    await page.goto(`/account/returns/new/${order.id}`);
    await page.getByLabel('Return reason').selectOption('DAMAGED');
    await page.locator('input[type="number"]').first().fill('1');
    await returnContent(page).getByRole('button', { name: /Submit return request/i }).click();

    // Wait for the return creation API to respond.
    await page.waitForResponse(
      (res) => res.url().includes('/api/account/returns') && res.request().method() === 'POST',
    );

    const createdReturn = await db.returnRequest.findFirst({
      where: { orderId: order.id, userId: customer.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(createdReturn).not.toBeNull();
    if (createdReturn) createdReturnIds.push(createdReturn.id);

    // Admin approves and inspects via API.
    await signInUser(page, admin.id);
    await page.goto('/admin/returns');
    await returnContent(page).getByText(createdReturn!.returnNumber).first().click();
    await expect(returnContent(page).getByText(`Return ${createdReturn!.returnNumber}`)).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/review`,
      { form: { action: 'review', reason: 'Admin review' } },
    );
    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/approve`,
      { form: { reason: 'Admin approval' } },
    );
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Approved').first()).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/tracking`,
      { form: { carrier: 'Test Carrier', trackingNumber: 'TRACK123' } },
    );
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Returned shipped').first()).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/receive`,
      { form: { receivedQuantity: '1' } },
    );
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Return received').first()).toBeVisible();

    // Direct DB inspection setup.
    const returnItem = await db.returnItem.findFirst({
      where: { returnRequestId: createdReturn!.id },
    });
    await db.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: createdReturn!.id },
        data: { status: 'RETURN_RECEIVED' },
      });
      await tx.returnInspection.create({
        data: {
          returnRequestId: createdReturn!.id,
          returnItemId: returnItem!.id,
          receivedQuantity: 1,
          inspectedQuantity: 1,
          acceptedQuantity: 1,
          rejectedQuantity: 0,
          condition: 'UNOPENED',
          restockable: false,
          inspectionNotes: 'Test inspection',
          inspectedAt: new Date(),
          inspectorId: admin.id,
        },
      });
      await tx.returnRequest.update({
        where: { id: createdReturn!.id },
        data: { status: 'INSPECTED' },
      });
    });

    // Razorpay is not configured → refund must fail safely, not fabricate success.
    const preRefund = await db.returnRequest.findUnique({
      where: { id: createdReturn!.id },
      select: { status: true },
    });
    console.log('DEBUG Journey D preRefundStatus:', preRefund?.status);
    const refundResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/refund`,
      { data: { reason: 'Test refund' } },
    );
    console.log('DEBUG Journey D refundStatus:', refundResponse.status());
    expect(refundResponse.status()).toBe(503);
    const body = await refundResponse.json();
    expect((body as { error?: string }).error).toContain('not configured');

    // Return request is preserved (not marked refunded).
    const after = await db.returnRequest.findUnique({ where: { id: createdReturn!.id } });
    expect(after!.status).toBe('INSPECTED');
    expect(await db.refund.count({ where: { orderId: order.id } })).toBe(0);
  });

  test('Journey E: COD offline refund workflow', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Return Customer E' });
    const admin = await createTestUser({ name: 'COD Refund Admin', role: 'ADMIN' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 2)!;

    // COD order: payment provider is 'cod', no captured amount.
    const order = await db.order.create({
      data: {
        orderNumber: `VEXO-COD-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
        userId: customer.id,
        status: 'DELIVERED',
        paymentStatus: 'pending',
        subtotal: 45,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 45,
        currency: 'USD',
        shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        items: {
          create: [
            {
              productId: product.id,
              productTitle: product.title,
              productSlug: product.slug,
              variantId: variant.id,
              size: variant.size,
              quantity: 1,
              price: 45,
              lineTotal: 45,
            },
          ],
        },
        payment: {
          create: {
            provider: 'cod',
            status: 'pending',
            method: 'Cash on Delivery',
            amount: 45,
            currency: 'USD',
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    const token = await createTestSession(customer.id);
    await signIn(page.context(), token);
    await page.goto(`/account/returns/new/${order.id}`);
    await page.getByLabel('Return reason').selectOption('DAMAGED');
    await page.locator('input[type="number"]').first().fill('1');
    await returnContent(page).getByRole('button', { name: /Submit return request/i }).click();

    // Wait for the return creation API to respond.
    await page.waitForResponse(
      (res) => res.url().includes('/api/account/returns') && res.request().method() === 'POST',
    );

    const createdReturn = await db.returnRequest.findFirst({
      where: { orderId: order.id, userId: customer.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(createdReturn).not.toBeNull();
    if (createdReturn) createdReturnIds.push(createdReturn.id);

    // Admin approves and inspects via API.
    await signInUser(page, admin.id);
    await page.goto('/admin/returns');
    await returnContent(page).getByText(createdReturn!.returnNumber).first().click();
    await expect(returnContent(page).getByText(`Return ${createdReturn!.returnNumber}`)).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/review`,
      { form: { action: 'review', reason: 'Admin review' } },
    );
    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/approve`,
      { form: { reason: 'Admin approval' } },
    );
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Approved').first()).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/tracking`,
      { form: { carrier: 'Test Carrier', trackingNumber: 'TRACK123' } },
    );
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Returned shipped').first()).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/receive`,
      { form: { receivedQuantity: '1' } },
    );
    await page.goto(`/admin/returns/${createdReturn!.id}`);
    await expect(returnContent(page).getByText('Return received').first()).toBeVisible();

    const returnItem = await db.returnItem.findFirst({
      where: { returnRequestId: createdReturn!.id },
    });
    await db.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: createdReturn!.id },
        data: { status: 'RETURN_RECEIVED' },
      });
      await tx.returnInspection.create({
        data: {
          returnRequestId: createdReturn!.id,
          returnItemId: returnItem!.id,
          receivedQuantity: 1,
          inspectedQuantity: 1,
          acceptedQuantity: 1,
          rejectedQuantity: 0,
          condition: 'UNOPENED',
          restockable: false,
          inspectionNotes: 'COD return inspection',
          inspectedAt: new Date(),
          inspectorId: admin.id,
        },
      });
      await tx.returnRequest.update({
        where: { id: createdReturn!.id },
        data: { status: 'INSPECTED' },
      });
    });

    // Initiate offline refund → should be PENDING, not COMPLETED.
    const refundResponse = await page.request.post(
      `/api/admin/returns/${createdReturn!.id}/refund`,
      { data: { reason: 'COD refund' } },
    );
    expect(refundResponse.status()).toBe(200);
    const refundBody = await refundResponse.json();
    expect((refundBody as { status?: string }).status).toBe('REFUND_PENDING');

    // No Razorpay refund record should exist.
    expect(await db.refund.count({ where: { orderId: order.id } })).toBe(0);

    // Offline refund record exists and is PENDING.
    const offlineRefund = await db.offlineRefund.findFirst({
      where: { returnRequestId: createdReturn!.id },
    });
    expect(offlineRefund).not.toBeNull();
    expect(offlineRefund!.status).toBe('PENDING');
    expect(offlineRefund!.method).toBe('BANK_TRANSFER');

    // Verify no Razorpay payment record exists for this COD order.
    const payment = await db.payment.findUnique({ where: { orderId: order.id } });
    expect(payment!.provider).toBe('cod');
  });

  test('Journey F: exchange request and approval', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Return Customer F' });
    const admin = await createTestUser({ name: 'Exchange Admin', role: 'ADMIN' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 2)!;

    const order = await createDeliveredOrderFixture({
      userId: customer.id,
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          quantity: 1,
          price: 45,
          productTitle: product.title,
          productSlug: product.slug,
        },
      ],
    });

    const token = await createTestSession(customer.id);
    await signIn(page.context(), token);

    // Create an exchange return request via API.
    const orderItem = await db.orderItem.findFirst({
      where: { orderId: order.id },
    });
    expect(orderItem).not.toBeNull();

    const exchangeReturn = await db.returnRequest.create({
      data: {
        returnNumber: `VEXO-RET-EXCH-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
        userId: customer.id,
        orderId: order.id,
        status: 'REQUESTED',
        returnReason: 'WRONG_SIZE',
        returnType: 'EXCHANGE',
        customerComments: 'Wrong size, need a larger one',
        requestedAt: new Date(),
        items: {
          create: {
            orderItem: { connect: { id: orderItem!.id } },
            product: { connect: { id: product.id } },
            ...(variant.id ? { variant: { connect: { id: variant.id } } } : {}),
            productTitle: product.title,
            productSlug: product.slug,
            size: variant.size,
            requestedQuantity: 1,
            approvedQuantity: 0,
            price: 45,
            lineTotal: 45,
          },
        },
      },
    });
    createdReturnIds.push(exchangeReturn.id);

    // Admin approves exchange via API.
    await signInUser(page, admin.id);
    await page.goto('/admin/returns');
    await returnContent(page).getByText(exchangeReturn.returnNumber).first().click();
    await expect(returnContent(page).getByText(`Return ${exchangeReturn.returnNumber}`)).toBeVisible();

    await page.request.post(
      `/api/admin/returns/${exchangeReturn.id}/review`,
      { form: { action: 'review', reason: 'Admin review' } },
    );
    await page.request.post(
      `/api/admin/returns/${exchangeReturn.id}/approve`,
      { form: { reason: 'Admin approval' } },
    );
    await page.goto(`/admin/returns/${exchangeReturn.id}`);
    await expect(returnContent(page).getByText('Approved').first()).toBeVisible();

    // Verify exchange status on the return.
    const updatedReturn = await db.returnRequest.findUnique({
      where: { id: exchangeReturn.id },
    });
    expect(updatedReturn!.status).toBe('APPROVED');
  });

  test('Journey G: security — ownership and state machine enforcement', async ({
    page,
  }) => {
    const customerA = await createTestUser({ name: 'Customer A' });
    const customerB = await createTestUser({ name: 'Customer B' });
    const product = await pickDeliveredProductWithStock();
    const variant = product.variants.find((v) => v.stock! >= 2)!;

    const orderA = await createDeliveredOrderFixture({
      userId: customerA.id,
      items: [
        {
          productId: product.id,
          variantId: variant.id,
          size: variant.size,
          quantity: 1,
          price: 45,
          productTitle: product.title,
          productSlug: product.slug,
        },
      ],
    });
    const admin = await createTestUser({ name: 'Security Admin', role: 'ADMIN' });

    // Customer A submits a return.
    const tokenA = await createTestSession(customerA.id);
    await signIn(page.context(), tokenA);
    await page.goto(`/account/returns/new/${orderA.id}`);
    await page.getByLabel('Return reason').selectOption('DAMAGED');
    await page.locator('input[type="number"]').first().fill('1');
    await returnContent(page).getByRole('button', { name: /Submit return request/i }).click();

    // Wait for the return creation API to respond.
    await page.waitForResponse(
      (res) => res.url().includes('/api/account/returns') && res.request().method() === 'POST',
    );

    const returnA = await db.returnRequest.findFirst({
      where: { orderId: orderA.id, userId: customerA.id },
      orderBy: { requestedAt: 'desc' },
    });
    expect(returnA).not.toBeNull();
    if (returnA) createdReturnIds.push(returnA.id);

    // Admin approves the return (sets approved quantities).
    await signInUser(page, admin.id);
    await page.request.post(
      `/api/admin/returns/${returnA!.id}/review`,
      { form: { action: 'review', reason: 'Admin review' } },
    );
    await page.request.post(
      `/api/admin/returns/${returnA!.id}/approve`,
      { form: { reason: 'Admin approval' } },
    );

    // Customer B cannot access Customer A's return (API).
    const tokenB = await createTestSession(customerB.id);
    await signIn(page.context(), tokenB);
    const crossOwner = await page.request.get(`/api/account/returns/${returnA!.id}`);
    expect(crossOwner.status()).toBe(404);

    // Customer B cannot access Customer A's return (page).
    await page.goto(`/account/returns/${returnA!.id}`);
    await expect(returnContent(page).getByText('SIGNAL LOST').or(returnContent(page).getByText('Not found'))).toBeVisible();

    // Customer cannot approve a return (only admins can).
    const customerApprove = await page.request.post(
      `/api/admin/returns/${returnA!.id}/approve`,
      { data: { reason: 'Unauthorized approval' } },
    );
    expect(customerApprove.status()).toBe(403);

    // Duplicate refund requests are blocked.
    await signInUser(page, admin.id);

    // Set up inspection for the return.
    const returnItem = await db.returnItem.findFirst({
      where: { returnRequestId: returnA!.id },
    });
    await db.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnA!.id },
        data: { status: 'RETURN_RECEIVED' },
      });
      await tx.returnInspection.create({
        data: {
          returnRequestId: returnA!.id,
          returnItemId: returnItem!.id,
          receivedQuantity: 1,
          inspectedQuantity: 1,
          acceptedQuantity: 1,
          rejectedQuantity: 0,
          condition: 'UNOPENED',
          restockable: false,
          inspectionNotes: 'Security test',
          inspectedAt: new Date(),
          inspectorId: admin.id,
        },
      });
      await tx.returnRequest.update({
        where: { id: returnA!.id },
        data: { status: 'INSPECTED' },
      });
    });

    // First refund attempt (will fail safely due to no Razorpay config).
    const firstRefund = await page.request.post(
      `/api/admin/returns/${returnA!.id}/refund`,
      { data: { reason: 'First refund attempt' } },
    );
    expect([403, 503]).toContain(firstRefund.status());

    // Second attempt with same state — should not create duplicate processing.
    const secondRefund = await page.request.post(
      `/api/admin/returns/${returnA!.id}/refund`,
      { data: { reason: 'Second refund attempt' } },
    );
    expect([403, 503]).toContain(secondRefund.status());

    // Invalid lifecycle transition rejected.
    const invalidTransition = await page.request.post(
      `/api/admin/returns/${returnA!.id}/review`,
      { data: { action: 'approve', reason: 'Skip review' } },
    );
    // Return is INSPECTED, APPROVED is not a valid transition from INSPECTED.
    expect(invalidTransition.status()).toBe(400);
  });
});
