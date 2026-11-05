# AuraShop (VEXO) — Context & Developer Knowledge Base

This document serves as the persistent system overview and technical context for developers and AI models working on the AuraShop (VEXO) codebase.

---

## 1. System Overview & Brand Identity

- **Brand**: **VEXO** — high-fashion architectural technical apparel and accessories.
- **Tagline**: *"THE FUTURE HAS FORM."* / *"FUTURE IS WEARABLE."*
- **Primary Routes**:
  - `/` — Homepage editorial (`TheEditPage`: campaign hero, expressions lookbook, material studies, chromatic studies, catalogue discovery).
  - `/collections` & `/collections/[category]` — Catalogue with category filters, sort parameters, and stock filter.
  - `/product/[id]` — Product detail page (PDP) with interactive carousel, size selection, 3D/Rive controls, and Cart additions.
  - `/cart` & `/checkout` — Customer checkout supporting guest checkout, multi-address capture, server-calculated totals, and payments.
  - `/wishlist` — Client-side persistent wishlist store.
  - `/admin/*` — Comprehensive operations dashboard (metrics, orders, payments, products, inventory, customers, activity logs).

---

## 2. Technology Stack & Key Versions

- **Framework**: Next.js 16.4.4 (App Router)
- **Runtime**: Node.js v26.8.2
- **Language**: Strict TypeScript (`tsconfig.json` with strict mode, no `any` workarounds)
- **Database & ORM**: PostgreSQL via Prisma ORM 7.10.1 with `@prisma/adapter-pg` driver adapter
- **Authentication**: NextAuth.js (Session-based + Role-based Access Control: `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`)
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` and `src/app/master.css`
- **Testing**:
  - Unit/Integration Tests: Node.js test runner via `tsx --test src/lib/*.test.ts` (27 passing tests)
  - End-to-End Tests: Playwright via `npx playwright test` (19 passing tests in `src/app/__tests__/smoke.test.ts`)
- **Payment Providers**: Razorpay (HMAC SHA-256 verification, Orders API, Refunds API, Webhooks) + Cash on Delivery (COD)

---

## 3. Database & Schema Architecture (`prisma/schema.prisma`)

The database connects via `postgresql://localhost:5432/aurashop` (both `DATABASE_URL` and `DIRECT_URL`).

### Key Models:
- **`User`**: Account records with `role` (`CUSTOMER`, `ADMIN`, `SUPER_ADMIN`), addresses, orders, and refund relations.
- **`Product` & `ProductVariant`**: Products contain category tags, prices, media galleries, descriptions, and variant SKUs/sizes/stock levels.
- **`Order`**:
  - `orderNumber`: Unique alphanumeric identifier (e.g. `VEXO-1730700000-ABCD`).
  - `userId`: Nullable string to seamlessly support guest checkout alongside authenticated accounts.
  - Snapshot fields: `guestEmail`, `guestName`, `guestPhone`, `shippingAddress` (JSON snapshot), `billingAddress` (JSON snapshot).
  - Financials: `subtotal`, `discount`, `shipping`, `tax`, `total`, `currency`.
  - Statuses: `orderStatus` (enum `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`), `paymentStatus` (enum `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`).
- **`OrderItem`**:
  - Historical snapshot fields: `productTitle`, `productSlug`, `productImage`, `variantId`, `size`, `quantity`, `unitPrice`, `lineTotal`.
- **`Payment`**:
  - Relation to `Order`.
  - Providers: `RAZORPAY`, `COD`.
  - Security fields: `providerPaymentId` (unique), `providerOrderId`, `providerSignature`, `verifiedAt`, `capturedAt`, `gatewayResponse` (JSON), `failureReason`.
- **`Refund`**:
  - Provider reference: `providerRefundId`.
  - Financial tracking: `amount`, `status`, `reason`, `gatewayResponse` (JSON), `actorId` (admin user who initiated the refund).
- **`Address`**: Normalized address book with `kind` (`SHIPPING`, `BILLING`), `userId` (nullable), and `orderId`.
- **`AdminAuditLog` & `AdminRateLimit`**:
  - Immutable audit trail for all admin operations (`action`, `entityType`, `entityId`, `actorId`, `ipAddress`, `metadata`).
  - IP-based sliding window rate-limiting for admin API calls.

---

## 4. Payment & Security Architecture

### Cryptographic Signature Verification (`src/lib/payment.ts`)
- Verification uses HMAC SHA-256 with constant-time comparison via `crypto.timingSafeEqual` to eliminate timing attacks.
- Calculation: `HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)`.
- Rejects empty, missing, malformed, non-string, or mismatched parameters safely without unhandled exceptions.
- Checks against duplicate verification and ensures payment ID has not been claimed by a different order.

### Webhook Handling (`src/app/api/payment/razorpay/webhook/route.ts`)
- Cryptographically verifies the raw-body signature using `X-Razorpay-Signature` and `RAZORPAY_WEBHOOK_SECRET`.
- Handles `payment.captured`, `payment.failed`, and `refund.processed`.
- Idempotently updates order status and stock to prevent duplicate decrements on repeated webhook deliveries.

### Checkout & Stock Concurrency (`src/app/api/checkout/route.ts`)
- **Server-Side Price Authority**: Never trusts frontend price or total calculations. Recalculates subtotal from database variant records.
- **Shipping Policy**: Free shipping for orders $\ge \$150$, otherwise flat $\$15$. Tax computed at 8%.
- **Atomic Stock Decrement**: Uses transactional updates (`updateMany WHERE id = variantId AND stock >= quantity`). Fails atomically if any item has insufficient stock.
- **COD Orders**: Decrements stock immediately upon order placement; sets `paymentStatus = 'PENDING'` and `orderStatus = 'PROCESSING'`.
- **Online Orders (Razorpay)**: Creates pending order and payment record. Stock is decremented upon verified payment completion (or via verified webhook).

### Admin Payment & Refund Management (`src/app/api/admin/payments/refund/route.ts`)
- Server-side role enforcement (`ADMIN` / `SUPER_ADMIN`).
- Validates eligible balance before issuing refund: `refundAmount <= payment.amount - alreadyRefunded`.
- Disallows refund requests on COD orders.
- Calls Razorpay server-side refund API (`https://api.razorpay.com/v1/payments/{payment_id}/refund`).
- Logs action to `AdminAuditLog`.

---

## 5. Next.js 16 Architectural Conventions & Nuances

Keep these critical rules in mind to avoid build and runtime errors:

1. **`cacheComponents: true` vs `dynamic = 'force-dynamic'`**:
   - In Next.js 16, `cacheComponents` replaces Partial Prerendering (PPR).
   - `export const dynamic = 'force-dynamic'` is **incompatible** with `cacheComponents: true`.
   - For administrative pages and dynamic shells, use `export const instant = false` instead.
2. **Build Tooling (`package.json`)**:
   - On Node.js v26+, Turbopack (`next build`) encounters process-spawning issues with `@tailwindcss/postcss` loader due to Node loader deprecation warnings.
   - Production build uses `next build --webpack` (`"build": "next build --webpack"`), which reliably compiles all routes and generates static pages.
3. **Route Guards & Streaming (`src/proxy.ts`)**:
   - Next.js 16 streaming cannot change the HTTP status code once streaming starts.
   - `src/proxy.ts` performs pre-render existence checks for `/collections/[category]` and `/product/[id]` to return clean HTTP 404 responses before streaming begins.
4. **Security Headers (`next.config.ts`)**:
   - Headers configured: `X-Content-Type-Options: nosniff`, `Referrer-Policy: origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
   - `X-Powered-By` is stripped.
   - **Crucial Rule**: In Next.js, never return a route entry with `headers: []` in `headers()` (e.g. via ternary operator `condition ? [...] : []`). Next.js will crash with `` `headers` field cannot be empty for route ``. Conditionally `.push()` entries instead.
5. **Cache Components & `new Date()` Prerendering Protection (`src/lib/products.ts`, `CatalogueContent.tsx`, `page.tsx`)**:
   - When Prisma or `@prisma/adapter-pg` executes queries, the underlying `pg` driver deserializes PostgreSQL timestamps as `new Date()`.
   - In Next.js 16 with `cacheComponents: true`, invoking `new Date()` during an un-cached, un-deferred prerender pass triggers:
     `Next.js encountered the unstable value new Date() while prerendering`.
   - **Remediation**:
     - Stable catalog functions (`getProductBySlug`, `getAllProductSlugs`, `getCategories`, `getFeaturedProducts`, `getProducts`) use `'use cache'`, `cacheLife(...)`, and `cacheTag(...)`.
     - Request-time dynamic streams (e.g. `CatalogueContent` awaiting `searchParams`) call `await connection()` inside `<Suspense fallback={...}>` to defer evaluation to request time.
     - Product detail pages await `params` inside `<Suspense>` rather than blocking at the page root, enabling instant static shell generation.

---

## 6. Verification & Test Commands

Run these standard commands from the repository root:

```bash
# 1. Prisma schema validation
npx prisma validate

# 2. Database migration status check
npx prisma migrate status

# 3. TypeScript type check (strict, no emit)
npx tsc --noEmit

# 4. ESLint check
npm run lint

# 5. Production build (compiles all static & dynamic routes)
npm run build

# 6. Dependency vulnerability audit
npm audit --omit=dev

# 7. Unit test suite (Payment, Checkout, Admin RBAC, Inventory rules)
npm test

# 8. End-to-End Playwright test suite (19 smoke tests)
npx playwright test
```

---

## 7. Environment Variables (`.env.example`)

Required configuration keys:

```ini
# Database (Prisma ORM)
DATABASE_URL="postgresql://sarthak@localhost:5432/aurashop"
DIRECT_URL="postgresql://sarthak@localhost:5432/aurashop"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-secret-here"

# Razorpay Payments (Live/Test keys)
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"

# Algolia Search (Optional)
NEXT_PUBLIC_ALGOLIA_APP_ID=""
NEXT_PUBLIC_ALGOLIA_SEARCH_KEY=""
ALGOLIA_WRITE_KEY=""
```

