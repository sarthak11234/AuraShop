import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

type CheckoutPayload = {
  items: Array<Record<string, unknown>>;
  customerInfo: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  paymentMethod: 'cod' | 'razorpay';
  total?: number;
};

const checkoutTestDatabase = process.env.CHECKOUT_TEST_DATABASE_URL;
let db: typeof import('../../lib/db').db;
let sessionId: string | null = null;
let userId: string | null = null;
let checkoutKey: string | null = null;

test.describe('customer checkout', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    if (
      !checkoutTestDatabase ||
      process.env.DATABASE_URL !== checkoutTestDatabase ||
      process.env.DIRECT_URL !== checkoutTestDatabase ||
      !new URL(checkoutTestDatabase).pathname.includes('checkout_test')
    ) {
      throw new Error('Checkout E2E tests require DATABASE_URL and DIRECT_URL to point at CHECKOUT_TEST_DATABASE_URL with a checkout_test database name.');
    }
    db = (await import('../../lib/db')).db;
  });

  test.afterAll(async () => {
    if (checkoutKey) {
      const order = await db.order.findUnique({
        where: { idempotencyKey: checkoutKey },
        include: { items: true },
      });
      if (order) {
        await db.$transaction(async (tx) => {
          for (const item of order.items) {
            if (item.variantId) {
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { increment: item.quantity } },
              });
            }
          }
          await tx.order.delete({ where: { id: order.id } });
        });
      }
    }
    if (sessionId) await db.session.deleteMany({ where: { id: sessionId } });
    if (userId) await db.user.deleteMany({ where: { id: userId } });
    if (db) await db.$disconnect();
  });

  test('authenticates, places COD from cart, uses database prices, and prevents duplicate orders', async ({ page, request }) => {
    const email = `checkout-${randomUUID()}@test.vexo.store`;
    const sessionToken = randomUUID();
    const session = await db.user.create({
      data: { email, name: 'Checkout Test Customer' },
    });
    userId = session.id;
    const authSession = await db.session.create({
      data: {
        sessionToken,
        userId: session.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    sessionId = authSession.id;
    await page.context().addCookies([{
      name: 'authjs.session-token',
      value: sessionToken,
      url: 'http://localhost:3000',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    const sessionResponse = await page.request.get('/api/auth/session');
    expect(sessionResponse.ok()).toBe(true);
    expect(await sessionResponse.json()).toMatchObject({ user: { email } });

    await page.goto('/collections?page=2');
    const quickAdd = page.locator('button[id^="quick-add-"]:not([disabled])').first();
    await expect(quickAdd).toBeVisible();
    const quickAddId = await quickAdd.getAttribute('id');
    expect(quickAddId).toBeTruthy();
    const productId = quickAddId!.slice('quick-add-'.length);
    const product = await db.product.findUnique({
      where: { id: productId },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    expect(product).not.toBeNull();
    const selectedVariant = product!.variants.find((variant) => variant.stock > 0);
    expect(selectedVariant).toBeTruthy();
    const originalStock = selectedVariant!.stock;
    const serverUnitPrice = Number(selectedVariant!.price ?? product!.price);

    await quickAdd.click();
    await expect(page.getByRole('dialog', { name: 'CART' })).toBeVisible();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    // The cart drawer must close on navigation, otherwise its fixed overlay
    // intercepts the checkout submit button (regression).
    await expect(page.getByRole('dialog', { name: 'CART' })).toBeHidden();
    await expect(page.getByText('Secure Checkout')).toBeVisible();

    const paymentAvailability = await page.request.get('/api/payment/razorpay');
    const paymentAvailabilityBody = await paymentAvailability.json() as { available: boolean };
    if (!paymentAvailabilityBody.available) {
      await expect(page.getByText(/Unavailable — gateway credentials are not configured/)).toBeVisible();
      await expect(page.getByRole('radio', { name: /Razorpay Online Gateway/ })).toBeDisabled();

      // The server must fail closed as well, not only the UI. A Razorpay
      // checkout attempt must be refused and no order may be persisted.
      const unconfiguredKey = randomUUID();
      const unconfiguredAttempt = await page.request.post('/api/checkout', {
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': unconfiguredKey,
          'X-Checkout-Token': randomUUID(),
        },
        data: {
          items: [{ productId, size: selectedVariant!.size, quantity: 1 }],
          customerInfo: { email, firstName: 'Test', lastName: 'Customer', phone: '+15550192831' },
          shippingAddress: { firstName: 'Test', lastName: 'Customer', addressLine1: '12 Test Avenue', city: 'Testville', state: 'CA', postalCode: '90210' },
          paymentMethod: 'razorpay',
        },
      });
      expect(unconfiguredAttempt.status()).toBe(503);
      expect((await unconfiguredAttempt.text()).toLowerCase()).toContain('not configured');
      expect(await db.order.findUnique({ where: { idempotencyKey: unconfiguredKey } })).toBeNull();

      const unconfiguredVerification = await page.request.post('/api/payment/razorpay/verify', {
        data: {
          orderId: 'unconfigured-order',
          razorpay_order_id: 'order_unconfigured',
          razorpay_payment_id: 'pay_unconfigured',
          razorpay_signature: 'forged',
        },
      });
      expect(unconfiguredVerification.status()).toBe(503);
    }

    await page.getByLabel('First Name').fill('Test');
    await page.getByLabel('Last Name').fill('Customer');
    await page.getByLabel('Email Address').fill('attacker@example.test');
    await page.getByLabel('Phone Number').fill('+1 555 019 2831');
    await page.getByLabel('Street Address').fill('12 Test Avenue');
    await page.getByLabel('City').fill('Testville');
    await page.getByLabel('State / Province').fill('CA');
    await page.getByLabel('Postal Code').fill('90210');

    const invalidAddressResponse = await page.request.post('/api/checkout', {
      headers: {
        'Idempotency-Key': randomUUID(),
        'X-Checkout-Token': randomUUID(),
      },
      data: {
        items: [{ productId, size: selectedVariant!.size, quantity: 1 }],
        customerInfo: { email, firstName: 'Test', lastName: 'Customer', phone: '+15550192831' },
        shippingAddress: { firstName: 'T', lastName: 'Customer', addressLine1: '12 Test Avenue', city: 'Testville', postalCode: '90210' },
        paymentMethod: 'cod',
      },
    });
    expect(invalidAddressResponse.status()).toBe(400);

    let checkoutPayload: CheckoutPayload | null = null;
    let requestIdempotencyKey: string | null = null;
    let requestCheckoutToken: string | null = null;
    await page.route('**/api/checkout', async (route) => {
      const body = route.request().postDataJSON() as CheckoutPayload;
      body.items[0].price = 0;
      body.total = 0;
      body.customerInfo.userId = 'client-supplied-user-id';
      checkoutPayload = body;
      const headers = await route.request().allHeaders();
      requestIdempotencyKey = headers['idempotency-key'] ?? null;
      requestCheckoutToken = headers['x-checkout-token'] ?? null;
      checkoutKey = requestIdempotencyKey;
      await route.continue({ postData: JSON.stringify(body) });
    });

    const checkoutResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith('/api/checkout') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Place COD Order' }).click();
    const checkoutResponse = await checkoutResponsePromise;
    expect(checkoutResponse.status()).toBe(201);
    const checkoutResult = await checkoutResponse.json() as {
      orderId: string;
      orderNumber: string;
      total: number;
      paymentStatus: string;
      status: string;
    };

    await expect(page.getByText('Order Confirmed')).toBeVisible();
    await expect(page.getByText(checkoutResult.orderNumber)).toBeVisible();
    expect(checkoutResult.status).toBe('CONFIRMED');
    expect(checkoutResult.paymentStatus).toBe('pending');
    expect(checkoutPayload).not.toBeNull();
    expect(requestIdempotencyKey).toBeTruthy();
    expect(requestCheckoutToken).toBeTruthy();

    const storedOrder = await db.order.findUnique({
      where: { id: checkoutResult.orderId },
      include: { items: true, payment: true },
    });
    expect(storedOrder?.userId).toBe(userId);
    expect(storedOrder?.guestEmail).toBeNull();
    expect(storedOrder?.payment?.provider).toBe('cod');
    expect(storedOrder?.payment?.status).toBe('pending');
    expect(Number(storedOrder?.items[0].price)).toBe(serverUnitPrice);
    expect(Number(storedOrder?.items[0].lineTotal)).toBe(serverUnitPrice);
    expect(Number(storedOrder?.total)).toBe(checkoutResult.total);
    expect(Number(storedOrder?.total)).not.toBe(0);
    expect((await db.productVariant.findUnique({ where: { id: selectedVariant!.id } }))?.stock).toBe(originalStock - 1);

    const duplicateResponse = await page.request.post('/api/checkout', {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': requestIdempotencyKey!,
        'X-Checkout-Token': requestCheckoutToken!,
      },
      data: checkoutPayload!,
    });
    expect(duplicateResponse.status()).toBe(200);
    expect((await duplicateResponse.json()).orderId).toBe(checkoutResult.orderId);
    expect((await db.productVariant.findUnique({ where: { id: selectedVariant!.id } }))?.stock).toBe(originalStock - 1);

    const overstockResponse = await page.request.post('/api/checkout', {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
        'X-Checkout-Token': randomUUID(),
      },
      data: {
        ...checkoutPayload!,
        items: [{ productId, size: selectedVariant!.size, quantity: originalStock + 1 }],
      },
    });
    expect(overstockResponse.status()).toBe(409);

    const historyResponse = await page.request.get('/api/orders?userId=another-customer');
    expect(historyResponse.status()).toBe(200);
    const history = await historyResponse.json() as Array<{ id: string; payment: Record<string, unknown> }>;
    expect(history.map((order) => order.id)).toEqual([checkoutResult.orderId]);
    expect(history[0].payment).not.toHaveProperty('providerSignature');
    await page.goto('/account/orders');
    await expect(page.getByRole('heading', { name: 'Order History' })).toBeVisible();
    await expect(page.locator('main').last().getByText(checkoutResult.orderNumber)).toBeVisible();

    const unauthenticatedHistory = await request.get('/api/orders?userId=' + userId);
    expect(unauthenticatedHistory.status()).toBe(401);
  });
});
