import { randomUUID } from 'node:crypto';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import type { OrderStatus } from '@prisma/client';

/**
 * Phase 12.1 customer-account journeys.
 *
 * These tests are intentionally destructive only inside an isolated database
 * whose name contains `checkout_test`. They never touch the development
 * database and clean up every user/order they create.
 */

const accountTestDatabase = process.env.CHECKOUT_TEST_DATABASE_URL;
let db: typeof import('../../lib/db').db;

const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];
const archivedProducts = new Map<string, Date | null>();

type TestProduct = {
  id: string;
  slug: string;
  title: string;
  price: unknown;
  images: unknown;
  archivedAt: Date | null;
  variants: Array<{ id: string; size: string; stock: number; price: unknown }>;
};

const addressSnapshot = {
  firstName: 'Test',
  lastName: 'Customer',
  company: null,
  phone: '+15550192831',
  addressLine1: '12 Test Avenue',
  addressLine2: null,
  city: 'Testville',
  state: 'CA',
  postalCode: '90210',
  country: 'USA',
};

const savedAddressPayload = {
  kind: 'shipping',
  firstName: 'Ada',
  lastName: 'Byron',
  company: 'Analytical Engines',
  phone: '+1 (555) 019-2831',
  addressLine1: '12 Computation Avenue',
  addressLine2: 'Suite 4',
  landmark: 'Next to the observatory',
  city: 'London',
  state: 'LDN',
  postalCode: 'N1 9GU',
  country: 'UK',
  isDefaultShipping: true,
  isDefaultBilling: true,
};

/** The rendered page content, excluding the RSC payload text in script tags. */
function accountContent(page: Page) {
  return page.locator('main').last();
}

function requireTestDatabase() {
  if (
    !accountTestDatabase ||
    process.env.DATABASE_URL !== accountTestDatabase ||
    process.env.DIRECT_URL !== accountTestDatabase ||
    !new URL(accountTestDatabase).pathname.includes('checkout_test')
  ) {
    throw new Error(
      'Account E2E tests require DATABASE_URL and DIRECT_URL to point at CHECKOUT_TEST_DATABASE_URL with a checkout_test database name.',
    );
  }
}

async function createTestUser({
  name = 'Account E2E Customer',
  role = 'CUSTOMER',
}: {
  name?: string;
  role?: 'CUSTOMER' | 'ADMIN';
} = {}) {
  const email = `account-e2e-${randomUUID()}@test.vexo.store`;
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

async function pickTestProduct({
  minStock = 1,
  categoryPublished = false,
}: {
  minStock?: number;
  categoryPublished?: boolean;
} = {}): Promise<TestProduct> {
  const product = await db.product.findFirst({
    where: {
      isPublished: true,
      archivedAt: null,
      variants: { some: { stock: { gte: minStock } } },
      ...(categoryPublished ? { categoryRecord: { isPublished: true } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      images: true,
      archivedAt: true,
      variants: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, size: true, stock: true, price: true },
      },
    },
  });
  if (!product) throw new Error('The isolated test database has no seeded product with stock.');
  return product;
}

type FixtureItem = {
  productId: string;
  productTitle: string;
  productSlug: string;
  productImage?: string | null;
  variantId?: string | null;
  size?: string | null;
  quantity: number;
  price: number;
};

type FixturePayment = {
  provider: string;
  status: string;
  method?: string | null;
  providerOrderId?: string | null;
  capturedAt?: Date | null;
};

async function createOrderFixture({
  userId,
  status = 'CONFIRMED',
  paymentStatus = 'pending',
  items,
  payment = null,
  createdAt,
  inventoryReserved = false,
  withAddressSnapshot = false,
  carrier = null,
  trackingNumber = null,
}: {
  userId: string;
  status?: OrderStatus;
  paymentStatus?: string;
  items: FixtureItem[];
  payment?: FixturePayment | null;
  createdAt?: Date;
  inventoryReserved?: boolean;
  withAddressSnapshot?: boolean;
  carrier?: string | null;
  trackingNumber?: string | null;
}) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderNumber = `VEXO-E2E-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
  const reservedAt = inventoryReserved ? new Date() : null;

  const order = await db.order.create({
    data: {
      orderNumber,
      userId,
      status,
      paymentStatus,
      subtotal,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: subtotal,
      currency: 'USD',
      shippingAddress: addressSnapshot,
      billingAddress: addressSnapshot,
      inventoryReservedAt: reservedAt,
      carrier,
      trackingNumber,
      ...(createdAt ? { createdAt } : {}),
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          productTitle: item.productTitle,
          productSlug: item.productSlug,
          productImage: item.productImage ?? null,
          variantId: item.variantId ?? null,
          size: item.size ?? null,
          quantity: item.quantity,
          price: item.price,
          lineTotal: item.price * item.quantity,
        })),
      },
      ...(withAddressSnapshot
        ? {
            addresses: {
              create: {
                userId,
                kind: 'shipping',
                ...addressSnapshot,
                isDefaultShipping: false,
                isDefaultBilling: false,
              },
            },
          }
        : {}),
      ...(payment
        ? {
            payment: {
              create: {
                provider: payment.provider,
                status: payment.status,
                method: payment.method ?? null,
                providerOrderId: payment.providerOrderId ?? null,
                capturedAt: payment.capturedAt ?? null,
                amount: subtotal,
                currency: 'USD',
              },
            },
          }
        : {}),
    },
    select: { id: true, orderNumber: true, status: true },
  });

  createdOrderIds.push(order.id);

  if (inventoryReserved) {
    for (const item of items) {
      if (!item.variantId) continue;
      await db.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      });
    }
  }

  return order;
}

test.describe('customer account journeys', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    requireTestDatabase();
    db = (await import('../../lib/db')).db;
  });

  test.afterAll(async () => {
    if (!db) return;

    try {
      const orders = await db.order.findMany({
        where: { id: { in: createdOrderIds } },
        select: {
          id: true,
          inventoryReservedAt: true,
          inventoryRestoredAt: true,
          items: { select: { variantId: true, quantity: true } },
        },
      });

      // A failed test must not leak reserved stock into the isolated database.
      for (const order of orders) {
        if (!order.inventoryReservedAt || order.inventoryRestoredAt) continue;
        for (const item of order.items) {
          if (!item.variantId) continue;
          await db.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      for (const [productId, archivedAt] of archivedProducts) {
        await db.product.update({ where: { id: productId }, data: { archivedAt } });
      }

      await db.adminAuditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db.adminRateLimit.deleteMany({ where: { actorId: { in: createdUserIds } } });
      await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      await db.address.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.account.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } finally {
      await db.$disconnect();
    }
  });

  test('Journey A: dashboard stats, profile permissions, and saved-address defaults', async ({
    page,
    request,
  }) => {
    const user = await createTestUser({ name: 'Ada Lovelace' });
    const token = await signInUser(page, user.id);
    expect(token).toBeTruthy();

    // Empty account starts from real zero-valued records.
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /Hello, Ada/i })).toBeVisible();
    await expect(accountContent(page).getByText('No orders yet')).toBeVisible();
    await expect(page.getByRole('link', { name: /Total orders/i })).toContainText('0');
    await expect(page.getByRole('link', { name: /Saved addresses/i })).toContainText('0');

    const product = await pickTestProduct();
    const order = await createOrderFixture({
      userId: user.id,
      status: 'CONFIRMED',
      items: [
        {
          productId: product.id,
          productTitle: 'Archived Snapshot Piece',
          productSlug: product.slug,
          productImage: null,
          size: 'M',
          quantity: 2,
          price: 46.5,
        },
      ],
      withAddressSnapshot: true,
    });

    await page.reload();
    await expect(page.getByRole('link', { name: /Total orders/i })).toContainText('1');
    await expect(page.getByRole('link', { name: /Active orders/i })).toContainText('1');
    await expect(accountContent(page).getByText(order.orderNumber)).toBeVisible();

    // Profile edits are restricted to the permitted fields.
    await page.goto('/account/profile');
    await expect(accountContent(page).getByText(user.email, { exact: true }).first()).toBeVisible();
    await page.getByLabel('Display name').fill('Ada Byron');
    await page.getByLabel('Phone number').fill('+1 (555) 019-2831');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status')).toHaveText('Profile saved.');

    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.name).toBe('Ada Byron');
    expect(updatedUser.phone).toBe('+15550192831');
    expect(updatedUser.email).toBe(user.email);
    expect(updatedUser.role).toBe('CUSTOMER');

    const forbiddenEmail = await page.request.patch('/api/account/profile', {
      data: { name: 'Ada Byron', email: 'attacker@example.test' },
    });
    expect(forbiddenEmail.status()).toBe(400);
    expect((await forbiddenEmail.text()).toLowerCase()).toContain('email');

    const forbiddenRole = await page.request.patch('/api/account/profile', {
      data: { name: 'Ada Byron', role: 'ADMIN' },
    });
    expect(forbiddenRole.status()).toBe(400);
    const unchangedUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchangedUser.role).toBe('CUSTOMER');
    expect(unchangedUser.email).toBe(user.email);

    // The request fixture has no session cookie, so account APIs fail closed.
    expect((await request.get('/api/account')).status()).toBe(401);
    expect(
      (
        await request.patch('/api/account/profile', {
          data: { name: 'Anonymous' },
        })
      ).status(),
    ).toBe(401);
    expect(
      (await request.get(`/api/account/orders/${order.id}`)).status(),
    ).toBe(401);

    // Saved address CRUD with one default per category.
    const firstAddressResponse = await page.request.post('/api/account/addresses', {
      data: savedAddressPayload,
    });
    expect(firstAddressResponse.status()).toBe(201);
    const firstAddress = (await firstAddressResponse.json()) as {
      address: {
        id: number;
        isDefaultShipping: boolean;
        isDefaultBilling: boolean;
        phone: string;
      };
    };
    expect(firstAddress.address.isDefaultShipping).toBe(true);
    expect(firstAddress.address.isDefaultBilling).toBe(true);
    expect(firstAddress.address.phone).toBe('+15550192831');

    const secondAddressResponse = await page.request.post('/api/account/addresses', {
      data: {
        ...savedAddressPayload,
        firstName: 'Grace',
        addressLine1: '44 Compiler Road',
        landmark: '',
        isDefaultShipping: true,
        isDefaultBilling: false,
      },
    });
    expect(secondAddressResponse.status()).toBe(201);
    const secondAddress = (await secondAddressResponse.json()) as {
      address: { id: number };
    };

    let addresses = (await (await page.request.get('/api/account/addresses')).json()) as {
      addresses: Array<{
        id: number;
        isDefaultShipping: boolean;
        isDefaultBilling: boolean;
      }>;
    };
    expect(addresses.addresses).toHaveLength(2);
    expect(addresses.addresses.filter((address) => address.isDefaultShipping)).toHaveLength(1);
    expect(addresses.addresses.filter((address) => address.isDefaultBilling)).toHaveLength(1);
    expect(
      addresses.addresses.find((address) => address.id === secondAddress.address.id)
        ?.isDefaultShipping,
    ).toBe(true);

    const makeBillingDefault = await page.request.patch(
      `/api/account/addresses/${firstAddress.address.id}`,
      {
        data: {
          ...savedAddressPayload,
          isDefaultShipping: false,
          isDefaultBilling: true,
        },
      },
    );
    expect(makeBillingDefault.status()).toBe(200);

    addresses = (await (await page.request.get('/api/account/addresses')).json()) as {
      addresses: Array<{
        id: number;
        isDefaultShipping: boolean;
        isDefaultBilling: boolean;
      }>;
    };
    expect(addresses.addresses.filter((address) => address.isDefaultBilling)).toHaveLength(1);
    expect(
      addresses.addresses.find((address) => address.id === firstAddress.address.id)
        ?.isDefaultBilling,
    ).toBe(true);
    expect(
      addresses.addresses.find((address) => address.id === secondAddress.address.id)
        ?.isDefaultBilling,
    ).toBe(false);

    // A different customer cannot read, edit or delete these addresses.
    const otherUser = await createTestUser({ name: 'Other Customer' });
    const ownerToken = await createTestSession(user.id);
    await signInUser(page, otherUser.id);

    const otherAddresses = (await (await page.request.get('/api/account/addresses')).json()) as {
      addresses: unknown[];
    };
    expect(otherAddresses.addresses).toHaveLength(0);

    const crossOwnerUpdate = await page.request.patch(
      `/api/account/addresses/${firstAddress.address.id}`,
      { data: savedAddressPayload },
    );
    expect(crossOwnerUpdate.status()).toBe(404);

    const crossOwnerDelete = await page.request.delete(
      `/api/account/addresses/${secondAddress.address.id}`,
    );
    expect(crossOwnerDelete.status()).toBe(404);
    expect(
      await db.address.findFirst({ where: { id: secondAddress.address.id, userId: user.id } }),
    ).not.toBeNull();

    // Back as the owner: deleting a saved address must not touch the immutable
    // order address snapshot or the JSON snapshot on the order.
    await signIn(page.context(), ownerToken);
    const deleteOwn = await page.request.delete(
      `/api/account/addresses/${secondAddress.address.id}`,
    );
    expect(deleteOwn.status()).toBe(200);

    const remainingAddresses = (await (
      await page.request.get('/api/account/addresses')
    ).json()) as { addresses: Array<{ id: number }> };
    expect(remainingAddresses.addresses.map((address) => address.id)).toEqual([
      firstAddress.address.id,
    ]);

    const snapshotAddress = await db.address.findFirst({
      where: { orderId: order.id, userId: user.id },
    });
    expect(snapshotAddress).not.toBeNull();
    expect(snapshotAddress?.addressLine1).toBe(addressSnapshot.addressLine1);

    const storedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(storedOrder.shippingAddress).toMatchObject({
      firstName: addressSnapshot.firstName,
      addressLine1: addressSnapshot.addressLine1,
    });
  });

  test('Journey B: server-side order pagination, filtering, sorting, and ownership', async ({
    page,
  }) => {
    const owner = await createTestUser({ name: 'Order Owner' });
    const other = await createTestUser({ name: 'Order Stranger' });
    const product = await pickTestProduct();
    const baseTime = new Date('2026-01-01T10:00:00.000Z').getTime();

    const orders: Array<{ id: string; orderNumber: string; status: OrderStatus }> = [];
    for (let index = 0; index < 12; index += 1) {
      const status: OrderStatus =
        index % 3 === 0 ? 'DELIVERED' : index % 3 === 1 ? 'SHIPPED' : 'CONFIRMED';
      const created = await createOrderFixture({
        userId: owner.id,
        status,
        items: [
          {
            productId: product.id,
            productTitle: `E2E Order ${index}`,
            productSlug: product.slug,
            size: 'M',
            quantity: 1,
            price: 10 + index,
          },
        ],
        createdAt: new Date(baseTime + index * 60_000),
      });
      orders.push({ ...created, status });
    }

    await signInUser(page, owner.id);

    const firstPageResponse = await page.request.get('/api/account/orders');
    expect(firstPageResponse.status()).toBe(200);
    const firstPage = (await firstPageResponse.json()) as {
      orders: Array<{ id: string; status: string }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };
    expect(firstPage.pagination).toEqual({ page: 1, pageSize: 10, total: 12, totalPages: 2 });
    expect(firstPage.orders).toHaveLength(10);
    expect(firstPage.orders[0].id).toBe(orders[11].id);
    expect(firstPage.orders[9].id).toBe(orders[2].id);

    const secondPage = (await (
      await page.request.get('/api/account/orders?page=2')
    ).json()) as {
      orders: Array<{ id: string }>;
      pagination: { page: number; totalPages: number };
    };
    expect(secondPage.pagination.page).toBe(2);
    expect(secondPage.orders.map((order) => order.id)).toEqual([orders[1].id, orders[0].id]);

    const oldest = (await (
      await page.request.get('/api/account/orders?sort=oldest&page=1')
    ).json()) as { orders: Array<{ id: string }>; pagination: { total: number } };
    expect(oldest.pagination.total).toBe(12);
    expect(oldest.orders[0].id).toBe(orders[0].id);

    const deliveredResponse = await page.request.get(
      '/api/account/orders?status=DELIVERED&sort=oldest',
    );
    const delivered = (await deliveredResponse.json()) as {
      orders: Array<{ id: string; status: string }>;
      pagination: { total: number };
      filters: { status: string; sort: string };
    };
    expect(delivered.pagination.total).toBe(4);
    expect(delivered.orders.every((order) => order.status === 'DELIVERED')).toBe(true);
    expect(delivered.filters).toEqual({ status: 'DELIVERED', sort: 'oldest' });

    const invalidFilter = await page.request.get('/api/account/orders?status=NOT_A_STATUS');
    expect(invalidFilter.status()).toBe(400);

    const ownerDetail = await page.request.get(`/api/account/orders/${orders[0].id}`);
    expect(ownerDetail.status()).toBe(200);
    const ownerDetailBody = (await ownerDetail.json()) as {
      order: { id: string; orderNumber: string; items: Array<{ productTitle: string }> };
    };
    expect(ownerDetailBody.order.orderNumber).toBe(orders[0].orderNumber);
    expect(ownerDetailBody.order.items[0].productTitle).toBe('E2E Order 0');

    await page.goto('/account/orders?status=DELIVERED&sort=oldest');
    await expect(page.getByRole('heading', { name: 'Order history' })).toBeVisible();
    await expect(accountContent(page).getByText('4 orders found for your account.')).toBeVisible();
    await expect(
      accountContent(page).getByText(orders.filter((order) => order.status === 'DELIVERED')[0].orderNumber),
    ).toBeVisible();
    await expect(accountContent(page).getByText('Next →')).toHaveCount(0);

    await page.goto('/account/orders');
    await expect(accountContent(page).getByText('Page 1 of 2')).toBeVisible();
    await expect(accountContent(page).getByText('Next →')).toBeVisible();

    // Cross-owner API and page access must fail closed.
    await signInUser(page, other.id);
    const crossOwnerDetail = await page.request.get(`/api/account/orders/${orders[0].id}`);
    expect(crossOwnerDetail.status()).toBe(404);
    const crossOwnerCancel = await page.request.post(
      `/api/account/orders/${orders[0].id}/cancel`,
      { data: { reason: 'Attempted cross-owner cancellation' } },
    );
    expect(crossOwnerCancel.status()).toBe(404);

    const crossOwnerPage = await page.goto(`/account/orders/${orders[0].id}`);
    // Streaming App Router responses can commit a 200 shell before an in-page
    // ownership miss is known; the API assertions above enforce 404. The page
    // must render the generic not-found UI and must not expose any order data.
    expect([200, 404]).toContain(crossOwnerPage?.status());
    await expect(accountContent(page).getByText('SIGNAL LOST')).toBeVisible();
    await expect(
      accountContent(page).getByText(orders[0].orderNumber),
    ).toHaveCount(0);
    await expect(accountContent(page).getByText('E2E Order 0')).toHaveCount(0);
  });

  test('Journey C: historical snapshots and safe COD cancellation', async ({ page }) => {
    const customer = await createTestUser({ name: 'Cancellation Customer' });
    const stranger = await createTestUser({ name: 'Cancellation Stranger' });
    const product = await pickTestProduct({ minStock: 3 });
    const variant = product.variants.find((item) => item.stock >= 3)!;
    const originalStock = variant.stock;
    const snapshotPrice = 99.99;
    const snapshotTitle = 'Legacy VEXO Piece';

    const codOrder = await createOrderFixture({
      userId: customer.id,
      status: 'CONFIRMED',
      paymentStatus: 'pending',
      inventoryReserved: true,
      items: [
        {
          productId: product.id,
          productTitle: snapshotTitle,
          productSlug: product.slug,
          productImage: null,
          variantId: variant.id,
          size: variant.size,
          quantity: 2,
          price: snapshotPrice,
        },
      ],
      payment: { provider: 'cod', status: 'pending', method: 'Cash on Delivery' },
    });

    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(
      originalStock - 2,
    );

    await signInUser(page, customer.id);

    const detailResponse = await page.request.get(`/api/account/orders/${codOrder.id}`);
    expect(detailResponse.status()).toBe(200);
    const detail = (await detailResponse.json()) as {
      order: {
        itemCount: number;
        items: Array<{ productTitle: string; price: number; quantity: number }>;
        cancellation: { eligible: boolean };
        shippingAddressSnapshot: { addressLine1: string } | null;
      };
    };
    expect(detail.order.items[0].productTitle).toBe(snapshotTitle);
    expect(detail.order.items[0].price).toBe(snapshotPrice);
    expect(detail.order.items[0].quantity).toBe(2);
    expect(detail.order.shippingAddressSnapshot?.addressLine1).toBe(
      addressSnapshot.addressLine1,
    );
    expect(detail.order.cancellation.eligible).toBe(true);

    await page.goto(`/account/orders/${codOrder.id}`);
    await expect(page.getByRole('heading', { name: codOrder.orderNumber })).toBeVisible();
    await expect(accountContent(page).getByText(snapshotTitle).first()).toBeVisible();
    await expect(accountContent(page).getByText('Cancel this order')).toBeVisible();

    // Ownership is enforced before any mutation.
    await signInUser(page, stranger.id);
    const crossOwnerCancel = await page.request.post(
      `/api/account/orders/${codOrder.id}/cancel`,
      { data: { reason: 'Cross-owner attempt' } },
    );
    expect(crossOwnerCancel.status()).toBe(404);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(
      originalStock - 2,
    );

    await signInUser(page, customer.id);
    const cancelResponse = await page.request.post(
      `/api/account/orders/${codOrder.id}/cancel`,
      { data: { reason: 'Ordered the wrong size' } },
    );
    expect(cancelResponse.status()).toBe(200);
    expect((await cancelResponse.json()) as { status: string }).toMatchObject({
      success: true,
      status: 'CANCELLED',
    });

    const cancelledOrder = await db.order.findUniqueOrThrow({
      where: { id: codOrder.id },
      include: { payment: true, trackingEvents: true, refunds: true },
    });
    expect(cancelledOrder.status).toBe('CANCELLED');
    expect(cancelledOrder.cancelledAt).not.toBeNull();
    expect(cancelledOrder.inventoryRestoredAt).not.toBeNull();
    expect(cancelledOrder.cancellationReason).toBe('Ordered the wrong size');
    expect(cancelledOrder.payment?.status).toBe('cancelled');
    expect(cancelledOrder.trackingEvents.filter((event) => event.status === 'CANCELLED')).toHaveLength(1);
    expect(cancelledOrder.trackingEvents.find((event) => event.status === 'CANCELLED')?.source).toBe(
      'CUSTOMER',
    );
    expect(cancelledOrder.refunds).toHaveLength(0);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(
      originalStock,
    );

    const duplicateCancel = await page.request.post(
      `/api/account/orders/${codOrder.id}/cancel`,
      { data: { reason: 'Try again' } },
    );
    expect(duplicateCancel.status()).toBe(409);
    expect(((await duplicateCancel.json()) as { code: string }).code).toBe('ALREADY_CANCELLED');
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(
      originalStock,
    );
    expect(await db.refund.count({ where: { orderId: codOrder.id } })).toBe(0);

    // Captured online payments are never cancelled as if they were refunded.
    const paidOrder = await createOrderFixture({
      userId: customer.id,
      status: 'CONFIRMED',
      paymentStatus: 'paid',
      items: [
        {
          productId: product.id,
          productTitle: snapshotTitle,
          productSlug: product.slug,
          variantId: variant.id,
          size: variant.size,
          quantity: 1,
          price: snapshotPrice,
        },
      ],
      payment: {
        provider: 'razorpay',
        status: 'captured',
        method: 'Razorpay',
        providerOrderId: `order_${randomUUID().replaceAll('-', '')}`,
        capturedAt: new Date(),
      },
    });

    const paidCancel = await page.request.post(
      `/api/account/orders/${paidOrder.id}/cancel`,
      { data: { reason: 'Please cancel my paid order' } },
    );
    expect(paidCancel.status()).toBe(409);
    expect(((await paidCancel.json()) as { code: string }).code).toBe('PAID_ONLINE');
    expect((await db.order.findUniqueOrThrow({ where: { id: paidOrder.id } })).status).toBe(
      'CONFIRMED',
    );
    expect(await db.refund.count({ where: { orderId: paidOrder.id } })).toBe(0);

    // Shipped COD orders are past the safe cancellation window.
    const shippedOrder = await createOrderFixture({
      userId: customer.id,
      status: 'SHIPPED',
      paymentStatus: 'pending',
      items: [
        {
          productId: product.id,
          productTitle: snapshotTitle,
          productSlug: product.slug,
          variantId: null,
          size: variant.size,
          quantity: 1,
          price: snapshotPrice,
        },
      ],
      payment: { provider: 'cod', status: 'pending', method: 'Cash on Delivery' },
    });
    const shippedCancel = await page.request.post(
      `/api/account/orders/${shippedOrder.id}/cancel`,
      { data: { reason: 'Too late to cancel' } },
    );
    expect(shippedCancel.status()).toBe(409);
    expect(((await shippedCancel.json()) as { code: string }).code).toBe('NOT_CANCELLABLE');
    const stillShipped = await db.order.findUniqueOrThrow({ where: { id: shippedOrder.id } });
    expect(stillShipped.status).toBe('SHIPPED');
    expect(stillShipped.inventoryRestoredAt).toBeNull();
  });

  test('Journey D: admin authorization, tracking, audit history, and idempotency', async ({
    page,
    request,
  }) => {
    const customer = await createTestUser({ name: 'Tracking Customer' });
    const admin = await createTestUser({ name: 'Tracking Admin', role: 'ADMIN' });
    const product = await pickTestProduct();

    const order = await createOrderFixture({
      userId: customer.id,
      status: 'PENDING',
      items: [
        {
          productId: product.id,
          productTitle: 'Tracked Piece',
          productSlug: product.slug,
          size: 'M',
          quantity: 1,
          price: 55,
        },
      ],
    });

    const statusUpdate = {
      status: 'CONFIRMED',
      reason: 'Payment verified by support',
    };

    // No session -> 401; customer session -> 403.
    const anonymousUpdate = await request.patch(`/api/admin/orders/${order.id}`, {
      data: statusUpdate,
    });
    expect(anonymousUpdate.status()).toBe(401);

    await signInUser(page, customer.id);
    const customerUpdate = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: statusUpdate,
    });
    expect(customerUpdate.status()).toBe(403);

    await signInUser(page, admin.id);

    const invalidTransition = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { status: 'SHIPPED', reason: 'Skipping fulfilment steps' },
    });
    expect(invalidTransition.status()).toBe(409);

    for (const status of ['CONFIRMED', 'PROCESSING', 'PACKED'] as const) {
      const response = await page.request.patch(`/api/admin/orders/${order.id}`, {
        data: { status, reason: `Moving order to ${status}` },
      });
      expect(response.status()).toBe(200);
    }

    const shippedAt = new Date(Date.now() - 60 * 60 * 1000);
    const shipResponse = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: {
        status: 'SHIPPED',
        reason: 'Handed to the carrier',
        carrier: 'Royal Mail',
        trackingNumber: 'RM123456789GB',
        trackingUrl: 'https://track.example.test/RM123456789GB',
        location: 'London',
        description: 'Collected by Royal Mail',
        shippedAt: shippedAt.toISOString(),
      },
    });
    expect(shipResponse.status()).toBe(200);

    const adminOrderResponse = await page.request.get(`/api/admin/orders/${order.id}`);
    expect(adminOrderResponse.status()).toBe(200);
    const adminOrder = (await adminOrderResponse.json()) as {
      status: string;
      carrier: string | null;
      trackingNumber: string | null;
      trackingEvents: Array<{
        status: string;
        source: string;
        carrier: string | null;
        trackingNumber: string | null;
      }>;
    };
    expect(adminOrder.status).toBe('SHIPPED');
    expect(adminOrder.carrier).toBe('Royal Mail');
    expect(adminOrder.trackingNumber).toBe('RM123456789GB');
    expect(
      adminOrder.trackingEvents.map((event) => event.status),
    ).toEqual(['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED']);
    expect(adminOrder.trackingEvents.every((event) => event.source === 'ADMIN')).toBe(true);

    const auditAfterStatus = await db.adminAuditLog.findMany({
      where: { entityType: 'order', entityId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      auditAfterStatus.filter((event) => event.action === 'order.status_updated'),
    ).toHaveLength(4);

    // Re-saving an existing shipment must update the single persisted event,
    // never append a duplicate timeline entry.
    const trackingUpdate = await page.request.patch(
      `/api/admin/orders/${order.id}/tracking`,
      {
        data: {
          carrier: 'Royal Mail',
          trackingNumber: 'RM999999999GB',
          description: 'Tracking number corrected',
        },
      },
    );
    expect(trackingUpdate.status()).toBe(200);
    expect((await trackingUpdate.json()) as { shipmentEventRecorded: boolean }).toMatchObject({
      success: true,
      shipmentEventRecorded: true,
    });

    const eventsAfterTracking = await db.orderTrackingEvent.findMany({
      where: { orderId: order.id, status: 'SHIPPED' },
    });
    expect(eventsAfterTracking).toHaveLength(1);
    expect(eventsAfterTracking[0].trackingNumber).toBe('RM999999999GB');
    expect(eventsAfterTracking[0].description).toBe('Tracking number corrected');

    const duplicateStatus = await page.request.patch(`/api/admin/orders/${order.id}`, {
      data: { status: 'SHIPPED', reason: 'Repeat the same update' },
    });
    expect(duplicateStatus.status()).toBe(409);
    expect(
      await db.orderTrackingEvent.count({ where: { orderId: order.id, status: 'SHIPPED' } }),
    ).toBe(1);

    const auditAfterTracking = await db.adminAuditLog.findMany({
      where: { entityType: 'order', entityId: order.id },
    });
    expect(
      auditAfterTracking.filter((event) => event.action === 'order.tracking_updated'),
    ).toHaveLength(1);
    expect(
      auditAfterTracking.filter((event) => event.action === 'order.status_updated'),
    ).toHaveLength(4);

    // The customer-facing timeline is persisted and contains no invented ETA.
    await signInUser(page, customer.id);
    const trackingResponse = await page.request.get(
      `/api/account/orders/${order.id}/tracking`,
    );
    expect(trackingResponse.status()).toBe(200);
    const tracking = (await trackingResponse.json()) as {
      provider: { id: string; automaticTracking: boolean };
      carrier: string;
      trackingNumber: string;
      timeline: Array<{ status: string; source: string; derived: boolean }>;
    };
    expect(tracking.provider).toMatchObject({ id: 'manual', automaticTracking: false });
    expect(tracking.carrier).toBe('Royal Mail');
    expect(tracking.trackingNumber).toBe('RM999999999GB');
    expect(tracking.timeline[0]).toMatchObject({ status: 'ORDER_PLACED', derived: true });
    expect(tracking.timeline.map((event) => event.status)).toEqual([
      'ORDER_PLACED',
      'CONFIRMED',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
    ]);
    expect(JSON.stringify(tracking).toLowerCase()).not.toContain('estimated');

    await page.goto(`/account/orders/${order.id}/tracking`);
    await expect(page.getByRole('heading', { name: 'Tracking' })).toBeVisible();
    await expect(
      accountContent(page).getByRole('link', { name: 'RM999999999GB' }),
    ).toBeVisible();
    await expect(accountContent(page).getByText('Manual fulfilment')).toBeVisible();

    // Admin UI exposes the same persisted data, not a separate representation.
    await signInUser(page, admin.id);
    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByRole('heading', { name: order.orderNumber })).toBeVisible();
    await expect(accountContent(page).getByText('Manual shipment and tracking')).toBeVisible();
    await expect(accountContent(page).getByText('RM999999999GB').first()).toBeVisible();
    await expect(accountContent(page).getByText('order status updated').first()).toBeVisible();
  });

  test('Journey E: wishlist ownership/availability, settings, and account navigation', async ({
    page,
  }) => {
    const customer = await createTestUser({ name: 'Wishlist Customer' });
    const other = await createTestUser({ name: 'Wishlist Stranger' });
    const product = await pickTestProduct({ categoryPublished: true });
    expect(product.archivedAt).toBeNull();

    await signInUser(page, customer.id);

    // Add from the storefront and see it in the account wishlist.
    const productPageResponse = await page.goto(`/product/${product.slug}`);
    expect(productPageResponse?.status()).toBe(200);
    await page.getByRole('button', { name: new RegExp(`Add ${product.title} to wishlist`, 'i') }).click();
    await expect(
      page.getByRole('link', { name: /Open wishlist, 1 item/i }),
    ).toBeVisible();

    await page.goto('/account/wishlist');
    await expect(page.getByRole('heading', { name: 'WISHLIST' })).toBeVisible();
    await expect(accountContent(page).getByText('1 ITEM')).toBeVisible();
    await expect(accountContent(page).getByText(product.title).first()).toBeVisible();

    // Add-to-cart from the wishlist still uses the catalogue variant data.
    const quickAdd = page.locator(`#quick-add-${product.id}`);
    await expect(quickAdd).toBeEnabled();
    await quickAdd.click();
    await expect(page.getByRole('dialog', { name: 'CART' })).toBeVisible();
    await page.getByRole('button', { name: 'Close cart' }).click();
    await expect(page.getByRole('dialog', { name: 'CART' })).toBeHidden();

    // Archived products stay in the wishlist but are shown as unavailable.
    archivedProducts.set(product.id, product.archivedAt);
    await db.product.update({ where: { id: product.id }, data: { archivedAt: new Date() } });

    await page.goto('/account/wishlist');
    await expect(accountContent(page).getByText(product.title).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'SOLD_OUT' }).first()).toBeDisabled();
    await expect(accountContent(page).getByText('1 ITEM')).toBeVisible();

    await db.product.update({ where: { id: product.id }, data: { archivedAt: product.archivedAt } });
    archivedProducts.delete(product.id);
    await page.reload();
    await expect(page.locator(`#quick-add-${product.id}`)).toBeEnabled();

    // Removal is explicit and available to the owning customer.
    await page
      .getByRole('button', { name: new RegExp(`Remove ${product.title} from wishlist`, 'i') })
      .click();
    await expect(accountContent(page).getByText('0 ITEMS')).toBeVisible();

    // Re-add, then sign in as a different customer. The browser-persisted
    // wishlist must not leak across accounts.
    await page.goto(`/product/${product.slug}`);
    await page.getByRole('button', { name: new RegExp(`Add ${product.title} to wishlist`, 'i') }).click();
    await expect(page.getByRole('link', { name: /Open wishlist, 1 item/i })).toBeVisible();

    await signInUser(page, other.id);
    await page.goto('/account/wishlist');
    await expect(accountContent(page).getByText('0 ITEMS')).toBeVisible();
    await expect(accountContent(page).getByText('NO SAVED PIECES')).toBeVisible();

    // Settings only advertise capabilities supported by the auth stack.
    await page.goto('/account/settings');
    await expect(accountContent(page).getByText('Password management')).toBeVisible();
    await expect(accountContent(page).getByText('Not available. Accounts sign in through Google')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(accountContent(page).getByText('Email magic link').first()).toBeVisible();
    await expect(accountContent(page).getByText(/In-app account deletion is intentionally unavailable/i)).toBeVisible();

    // Header account menu exposes every account route.
    await page.locator('#header-user-menu').click();
    const accountMenu = page.locator('#header-account-menu');
    await expect(accountMenu).toBeVisible();
    for (const label of ['OVERVIEW', 'ORDERS', 'ADDRESSES', 'WISHLIST', 'PROFILE', 'SETTINGS']) {
      await expect(accountMenu.getByRole('menuitem', { name: label })).toBeVisible();
    }

    await accountMenu.getByRole('menuitem', { name: 'ORDERS' }).click();
    await expect(page).toHaveURL(/\/account\/orders$/);
    await expect(page.getByRole('heading', { name: 'Order history' })).toBeVisible();
    await expect(accountContent(page).getByText('No orders yet')).toBeVisible();
  });
});
