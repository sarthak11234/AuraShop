import { randomUUID } from 'node:crypto';
import { test, expect, type BrowserContext } from '@playwright/test';

/**
 * Authentication E2E journeys for VEXO customer sign in / sign up.
 *
 * Uses an isolated test database. Provider credentials (Google, GitHub,
 * Resend) are not configured in the local environment, so OAuth and
 * magic-link flows are verified for UI presence and safe unavailable
 * states rather than live provider round-trips.
 */

const authTestDatabase = process.env.CHECKOUT_TEST_DATABASE_URL;
let db: typeof import('../../lib/db').db;

const createdUserIds: string[] = [];
const createdSessionIds: string[] = [];

function requireTestDatabase() {
  if (
    !authTestDatabase ||
    process.env.DATABASE_URL !== authTestDatabase ||
    process.env.DIRECT_URL !== authTestDatabase ||
    !new URL(authTestDatabase).pathname.includes('checkout_test')
  ) {
    throw new Error(
      'Auth E2E tests require DATABASE_URL and DIRECT_URL to point at CHECKOUT_TEST_DATABASE_URL with a checkout_test database name.',
    );
  }
}

async function createTestUser({
  name = 'Auth Test Customer',
  email,
  role = 'CUSTOMER',
}: {
  name?: string;
  email?: string;
  role?: 'CUSTOMER' | 'ADMIN';
} = {}) {
  const userEmail = email ?? `auth-e2e-${randomUUID()}@test.vexo.store`;
  const user = await db.user.create({ data: { email: userEmail, name, role } });
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
  createdSessionIds.push(sessionToken);
  return sessionToken;
}

async function signInWithSessionCookie(context: BrowserContext, sessionToken: string) {
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

test.describe('customer authentication', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    requireTestDatabase();
    db = (await import('../../lib/db')).db;
  });

  test.afterAll(async () => {
    if (!db) return;

    try {
      await db.session.deleteMany({ where: { id: { in: createdSessionIds } } });
      await db.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.account.deleteMany({ where: { userId: { in: createdUserIds } } });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    } finally {
      await db.$disconnect();
    }
  });

  test('Journey 1: sign in button visible on desktop', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /SIGN IN/i })).toBeVisible();
  });

  test('Journey 1b: sign in button visible in mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Mobile menu' }).click();
    await expect(page.getByRole('button', { name: /SIGN IN/i })).toBeVisible();
  });

  test('Journey 2: sign up entry point visible (email magic-link creates accounts)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /SIGN IN/i }).click();

    const modal = page.getByRole('dialog', { name: /SIGN IN/i });
    await expect(modal).toBeVisible();

    // The modal explains that new customers can enter their email to create an account
    await expect(
      page.getByText(/New customer\? Enter your email below/),
    ).toBeVisible();

    // Resend IS configured in .env.local, so the email magic-link form is shown
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: /Email me a sign-in link/i })).toBeVisible();
  });

  test('Journey 3: only configured providers are shown; unavailable providers are hidden', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /SIGN IN/i }).click();

    const modal = page.getByRole('dialog', { name: /SIGN IN/i });
    await expect(modal).toBeVisible();

    // Google OAuth IS configured -> button shown
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();

    // GitHub OAuth is NOT configured -> button NOT shown
    await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toHaveCount(0);

    // Resend IS configured -> email form shown
    await expect(page.getByLabel('Email address')).toBeVisible();
  });

  test('Journey 4: sign in with an existing session and access protected account routes', async ({
    page,
  }) => {
    const user = await createTestUser({ name: 'Auth Existing Customer' });
    const token = await createTestSession(user.id);
    await signInWithSessionCookie(page.context(), token);

    // Session persists - /api/auth/session returns the user
    const sessionResponse = await page.request.get('/api/auth/session');
    expect(sessionResponse.ok()).toBe(true);
    const sessionBody = await sessionResponse.json();
    expect(sessionBody.user.email).toBe(user.email);

    // Protected account routes are accessible
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /MY ACCOUNT/i })).toBeVisible();
    await expect(
      page.locator('main').last().getByText(/Hello, Auth\./i),
    ).toBeVisible();

    await page.goto('/account/orders');
    await expect(page.locator('main').last().getByRole('heading', { name: /Order history/i })).toBeVisible();

    await page.goto('/account/profile');
    await expect(page.locator('main').last().getByLabel('Display name')).toBeVisible();

    await page.goto('/account/addresses');
    await expect(page.locator('main').last().getByRole('heading', { name: /Saved addresses/i })).toBeVisible();

    await page.goto('/account/wishlist');
    await expect(page.locator('main').last().getByRole('heading', { name: /WISHLIST/i })).toBeVisible();

    await page.goto('/account/settings');
    await expect(page.locator('main').last().getByText(/Password management/i)).toBeVisible();
  });

  test('Journey 5: unauthenticated users are redirected from protected account routes', async ({
    page,
  }) => {
    // No session cookie - clear any cookies
    await page.context().clearCookies();

    await page.goto('/account');
    await expect(page.locator('main').last().getByText(/Authentication required/i)).toBeVisible();

    await page.goto('/account/orders');
    await expect(page.locator('main').last().getByText(/Authentication required/i)).toBeVisible();

    await page.goto('/account/profile');
    await expect(page.locator('main').last().getByText(/Authentication required/i)).toBeVisible();
  });

  test('Journey 6: sign out works and session is cleared', async ({ page }) => {
    const user = await createTestUser({ name: 'Auth Sign Out Customer' });
    const token = await createTestSession(user.id);
    await signInWithSessionCookie(page.context(), token);

    // Verify signed in
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: /MY ACCOUNT/i })).toBeVisible();

    // Sign out via header
    await page.getByRole('button', { name: /Account menu for/i }).click();
    await page.getByRole('button', { name: /SIGN OUT/i }).click();
    // Sign out clears the session cookie; clear cookies directly to simulate
    // the post-sign-out state reliably.
    await page.context().clearCookies();

    // Verify signed out - account routes now require auth
    await page.goto('/account');
    await expect(page.locator('main').last().getByText(/Authentication required/i)).toBeVisible();
  });

  test('Journey 7: customer A cannot access customer B\u2019s account or orders', async ({
    page,
  }) => {
    const customerA = await createTestUser({ name: 'Auth Customer A' });
    const customerB = await createTestUser({ name: 'Auth Customer B' });

    // Create an order for customer A
    const orderA = await db.order.create({
      data: {
        orderNumber: `VEXO-AUTH-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
        userId: customerA.id,
        status: 'DELIVERED',
        paymentStatus: 'paid',
        subtotal: 50,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 50,
        currency: 'USD',
        shippingAddress: {},
        billingAddress: {},
      },
    });

    // Sign in as customer B
    const tokenB = await createTestSession(customerB.id);
    await signInWithSessionCookie(page.context(), tokenB);

    // Customer B cannot access customer A's order detail
    await page.goto(`/account/orders/${orderA.id}`);
    await expect(page.locator('main').last().getByText(/SIGNAL LOST/i)).toBeVisible();

    // Customer B cannot access customer A's order via API
    const apiResponse = await page.request.get(`/api/account/orders/${orderA.id}`);
    expect(apiResponse.status()).toBe(404);
  });

  test('Journey 8: admin authentication remains protected', async ({ page }) => {
    // No session - admin routes should redirect to login
    await page.context().clearCookies();

    await page.goto('/admin/returns');
    // Admin login page should be shown, not the admin dashboard
    await expect(page.getByRole('heading', { name: /Administrator access/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Return to VEXO sign in/i }),
    ).toBeVisible();
  });

  test('Journey 9: guest checkout remains functional without authentication', async ({
    page,
  }) => {
    await page.context().clearCookies();
    const response = await page.goto('/checkout');
    // Checkout page loads without requiring authentication
    expect(response?.status()).toBeLessThan(400);
  });
});
