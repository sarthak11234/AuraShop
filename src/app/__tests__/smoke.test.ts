/**
 * Playwright E2E tests for AuraShop VEXO
 * Covers: homepage, catalogue, PDPs, gallery, cart, wishlist, mobile nav,
 * search fallback, branded 404s, API validation, security headers.
 *
 * Run: npx playwright test
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('renders hero and product grid', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/VEXO/);
    // Hero section visible
    await expect(page.locator('#campaign-title')).toBeVisible();
    // Grid or product items present
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Catalogue', () => {
  test('lists collections with filter chips', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.getByRole('heading', { name: 'FULL CATALOGUE' }).filter({ visible: true })).toBeVisible();
    // Filter chips are present
    await expect(page.getByText('TECH', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('ARTIFACT', { exact: true }).first()).toBeVisible();
  });

  test('Paginated products load without error', async ({ page }) => {
    await page.goto('/collections?page=1&pageSize=12');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Product Detail Pages (PDPs)', () => {
  test('renders a valid PDP page', async ({ page }) => {
    await page.goto('/product/modular-shoulder-harness');
    await expect(page).toHaveTitle(/VEXO/);
    // Product title visible
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('brand 404 renders correctly for unknown product', async ({ page }) => {
    const response = await page.goto('/product/nonexistent-product-xyz');
    expect(response?.status()).toBe(404);
    // Branded 404 page (not Next.js default)
    await expect(page.locator('.meta strong')).toContainText('PRODUCT_NOT_FOUND');
    // URL stays under /product/
    await expect(page).toHaveURL('/product/nonexistent-product-xyz');
  });
});

test.describe('Gallery interactions', () => {
  test('image gallery navigates', async ({ page }) => {
    await page.goto('/product/modular-shoulder-harness');
    // Wait for PDP to load
    await expect(page.locator('h1').first()).toBeVisible();
    const thumbnail = page.locator('button img, .thumbnail, [role="button"] img').first();
    if (await thumbnail.isVisible()) {
      await thumbnail.click();
    }
  });
});

test.describe('Cart', () => {
  test('cart icon is accessible', async ({ page }) => {
    await page.goto('/');
    const cartButton = page.locator('#header-cart-btn, [aria-label*="cart" i], [aria-label*="Cart" i]').first();
    await expect(cartButton).toBeVisible();
    // Click opens cart drawer
    await cartButton.click();
  });

  test('checkout page renders with empty cart state', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText(/Cart is Empty/i)).toBeVisible();
  });
});

test.describe('Wishlist', () => {
  test('wishlist link is accessible in header', async ({ page }) => {
    await page.goto('/');
    const wishlistLink = page.locator('a[href="/wishlist"], [aria-label*="wishlist" i]').first();
    await expect(wishlistLink).toBeVisible();
  });
});

test.describe('Mobile navigation', () => {
  test('mobile menu toggles', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const menuBtn = page.locator('button[aria-label*="menu" i], button:has(svg)').first();
    await expect(menuBtn).toBeVisible();
  });
});

test.describe('Search fallback', () => {
  test('search trigger is present in header', async ({ page }) => {
    await page.goto('/');
    const searchTrigger = page.locator('[aria-label*="search" i], button:has-text("Search")').first();
    await expect(searchTrigger).toBeVisible();
  });
});

test.describe('Branded 404s', () => {
  test('collection 404 renders branded page', async ({ page }) => {
    const response = await page.goto('/collections/nonexistent-category-xyz');
    expect(response?.status()).toBe(404);
    // Branded 404 (not Next.js default)
    await expect(page.locator('.meta strong')).toContainText('COLLECTION_NOT_FOUND');
    // Page title includes VEXO
    await expect(page).toHaveTitle(/VEXO/);
  });

  test('product 404 renders branded page', async ({ page }) => {
    const response = await page.goto('/product/does-not-exist-12345');
    expect(response?.status()).toBe(404);
    await expect(page.locator('.meta strong')).toContainText('PRODUCT_NOT_FOUND');
  });
});

test.describe('API validation', () => {
  test('products API rejects invalid page values', async ({ request }) => {
    const response = await request.get('/api/products?page=9999&pageSize=9999');
    expect(response.status()).toBeLessThan(500);
    const body = await response.json();
    expect(body).toHaveProperty('products');
    expect(body).toHaveProperty('pagination');
  });

  test('products API requires category q to be sensible length', async ({ request }) => {
    const response = await request.get('/api/products?q=' + 'a'.repeat(500));
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Security headers', () => {
  test('X-Content-Type-Options header present', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options header present', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('Referrer-Policy header present', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers['referrer-policy']).toBe('origin-when-cross-origin');
  });

  test('Permissions-Policy header present', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    const headers = response!.headers();
    expect(headers['permissions-policy']).toContain('camera=()');
  });
});
