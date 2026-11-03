/**
 * Playwright E2E tests for AuraShop VEXO — Phase 9 Security Remediation
 * Covers: homepage, catalogue, PDPs, gallery, cart, wishlist, mobile nav,
 * search fallback, branded 404s, API validation, security headers.
 *
 * Run: npx playwright test
 *      npx playwright test --project=chromium
 */

import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/collections',
  '/collections/TECH',
  '/collections/ARTIFACT',
];

test.describe('Homepage', () => {
  test('renders hero and product grid', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/VEXO/);
    // Hero section visible
    await expect(page.locator('text:FUTURE IS WEARABLE')).toBeVisible();
    // Product grid has items
    await expect(page.locator('.product-grid')).toBeVisible();
  });
});

test.describe('Catalogue', () => {
  test('lists collections with filter chips', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.locator('text:CATALOGUE')).toBeVisible();
    // Filter chips are present
    await expect(page.locator('text:TECH')).toBeVisible();
    await expect(page.locator('text:ARTIFACT')).toBeVisible();
  });

  test('Paginated products load without error', async ({ page }) => {
    await page.goto('/collections?page=1&pageSize=12');
    await expect(page.locator('.product-card')).toHaveCountGreaterThan(0);
  });
});

test.describe('Product Detail Pages (PDPs)', () => {
  test('renders a valid PDP page', async ({ page }) => {
    await page.goto('/product/modular-shoulder-harness');
    await expect(page).toHaveTitle(/VEXO/);
    // Product title visible
    await expect(page.locator('h1')).toBeVisible();
    // Image gallery present
    await expect(page.locator('.image-gallery')).toBeVisible();
  });

  test('brand 404 renders correctly for unknown product', async ({ page }) => {
    await page.goto('/product/nonexistent-product-xyz');
    // Branded 404 page (not Next.js default)
    await expect(page.locator('.meta strong')).toContainText('PRODUCT_NOT_FOUND');
    // URL stays under /product/
    await expect(page).toHaveURL('/product/nonexistent-product-xyz');
  });
});

test.describe('Gallery interactions', () => {
  test('image gallery navigates', async ({ page }) => {
    await page.goto('/product/modular-shoulder-harness');
    const firstThumb = page.locator('.thumbnail').first();
    await expect(firstThumb).toBeVisible();
    // Click thumbnail
    await firstThumb.click();
    // Main image updates or carousel moves
    await expect(page.locator('.main-image')).toBeVisible();
  });
});

test.describe('Cart', () => {
  test('cart icon is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text:cart')).toBeVisible();
    // Open cart drawer
    await page.locator('text:cart').click();
    await expect(page.locator('.cart-drawer')).toBeVisible();
  });

  test('adds product to cart from PDP', async ({ page }) => {
    await page.goto('/product/modular-shoulder-harness');
    await page.locator('text:Add to Cart').click();
    // Cart count updates
    await expect(page.locator('.cart-count')).toContainText('1');
  });
});

test.describe('Wishlist', () => {
  test('wishlist button is accessible', async ({ page }) => {
    await page.goto('/product/modular-shoulder-harness');
    await expect(page.locator('text:Wishlist')).toBeVisible();
  });
});

test.describe('Mobile navigation', () => {
  test('mobile menu toggles', async ({ page }) => {
    await page.goto('/');
    // Viewport < 640px
    await page.setViewportSize({ width: 375, height: 667 });
    await page.locator('text:Menu').click();
    await expect(page.locator('nav')).toBeVisible();
    await page.locator('text:Collections').click();
    await expect(page).toHaveURL('/collections');
  });
});

test.describe('Search fallback', () => {
  test('search bar is present and submits', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[placeholder*="search"]').fill('jacket');
    await page.locator('input[placeholder*="search"]').press('Enter');
    // Results page loads or fallback behaves gracefully
    await expect(page).toHaveURL('/collections');
  });
});

test.describe('Branded 404s', () => {
  test('collection 404 renders branded page', async ({ page }) => {
    await page.goto('/collections/nonexistent-category-xyz');
    // Branded 404 (not Next.js default)
    await expect(page.locator('.meta strong')).toContainText('COLLECTION_NOT_FOUND');
    // Page title includes VEXO
    await expect(page.locator('title')).toContainText('VEXO');
  });

  test('product 404 renders branded page', async ({ page }) => {
    await page.goto('/product/does-not-exist-12345');
    await expect(page.locator('.meta strong')).toContainText('PRODUCT_NOT_FOUND');
  });
});

test.describe('API validation', () => {
  test('products API rejects invalid page values', async ({ request }) => {
    const response = await request.get('/api/products?page=9999&pageSize=9999');
    // Should still return valid JSON (clamped), not crash
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
  const checkHeader = (page, header, expectedValue) => {
    const headers = page.serverResponse()?.headers();
    if (headers) {
      expect(headers[header]).toBe(expectedValue);
    }
  };

  test('X-Content-Type-Options header present', async ({ page }) => {
    await page.goto('/');
    // Check via CDP or response interceptor
    const response = await page.waitForResponse('/');
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('X-Frame-Options header present', async ({ page }) => {
    await page.goto('/');
    const response = await page.waitForResponse('/');
    const headers = response.headers();
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('Referrer-Policy header present', async ({ page }) => {
    await page.goto('/');
    const response = await page.waitForResponse('/');
    const headers = response.headers();
    expect(headers['referrer-policy']).toBe('origin-when-cross-origin');
  });

  test('Permissions-Policy header present', async ({ page }) => {
    await page.goto('/');
    const response = await page.waitForResponse('/');
    const headers = response.headers();
    expect(headers['permissions-policy']).toContain('camera=()');
  });
});