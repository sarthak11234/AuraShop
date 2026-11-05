# NETLIFY_PRODUCTS_BUILD_FIX_REPORT

**Project:** AuraShop / VEXO
**Phase:** Netlify Build Fix — Products API & Collection Page Database Initialization
**Date:** Fri Nov 06 2026

---

## 1. Root Cause and Exact Source Location

**Root cause:** Two `generateStaticParams()` functions execute database queries at **build time** during Next.js page-data collection. Without `DATABASE_URL`/`DIRECT_URL` in the build environment, the lazy Prisma Proxy in `src/lib/db.ts` throws when it tries to create a `PrismaClient`.

### Exact call chain for `/collections/[category]`:

1. `src/app/collections/[category]/page.tsx:8-11` — `generateStaticParams()` is called by Next.js at build time to enumerate static routes
2. `generateStaticParams()` calls `getCategories()` (imported from `@/lib/products`)
3. `getCategories()` in `src/lib/products.ts:304-315` uses `'use cache'` and accesses `db.product.findMany()` (line 308)
4. `db` is the lazy Proxy — accessing `db.product` triggers the Proxy's `get` handler → `getOrCreateClient()` → `createClient()` → throws `Error('Database connection string is missing...')`

### Same issue for `/product/[id]`:

1. `src/app/product/[id]/page.tsx:8-11` — `generateStaticParams()` calls `getAllProductSlugs()` at build time
2. `getAllProductSlugs()` in `src/lib/products.ts:291-301` accesses `db.product.findMany()` (line 295)
3. Same Proxy → `createClient()` → throws without `DATABASE_URL`

### Files with build-time database access:

| File | Line | Function | DB Call |
|------|------|----------|---------|
| `src/app/collections/[category]/page.tsx` | 8-11 | `generateStaticParams()` | `getCategories()` → `db.product.findMany()` |
| `src/app/product/[id]/page.tsx` | 8-11 | `generateStaticParams()` | `getAllProductSlugs()` → `db.product.findMany()` |

---

## 2. Environment-Variable Availability by Deployment Context

| Context | DATABASE_URL | DIRECT_URL | Notes |
|---------|-------------|------------|-------|
| Netlify Production | MISSING (unless configured) | MISSING (unless configured) | No `.env.local`; vars must be set in Netlify dashboard |
| Netlify Deploy Preview | MISSING (unless configured) | MISSING (unless configured) | Inherits from production env vars |
| Netlify Branch Deploy | MISSING (unless configured) | MISSING (unless configured) | Inherits from production env vars |
| Local Development | PRESENT (from `.env.local`) | PRESENT (from `.env.local`) | `postgresql://sarthak@localhost:5432/aurashop` |
| Isolated Test DB | PRESENT (exported for tests) | PRESENT (exported for tests) | `aurashop_checkout_test_cba2a23f` |

**Critical:** Next.js automatically loads `.env.local` during local builds, so DATABASE_URL is present locally. In Netlify, `.env.local` is NOT loaded — environment variables must be configured in the Netlify dashboard.

---

## 3. Product Data-Fetching Call Chain

### Collection page (`/collections/[category]`):

```
Next.js build (generateStaticParams)
  → getCategories() [src/lib/products.ts:304]
    → db.product.findMany() [src/lib/products.ts:308]
      → db Proxy get() [src/lib/db.ts:63-68]
        → getOrCreateClient() [src/lib/db.ts:40-54]
          → createClient() [src/lib/db.ts:15-32]
            → THROWS: no DATABASE_URL
```

### Product page (`/product/[id]`):

```
Next.js build (generateStaticParams)
  → getAllProductSlugs() [src/lib/products.ts:291]
    → db.product.findMany() [src/lib/products.ts:295]
      → db Proxy get() [src/lib/db.ts:63-68]
        → getOrCreateClient() [src/lib/db.ts:40-54]
          → createClient() [src/lib/db.ts:15-32]
            → THROWS: no DATABASE_URL
```

### At runtime (request time, not build time):

Both pages use `await connection()` from `next/server` inside their view components, which defers data fetching to request time. The `generateStaticParams` functions are only for enumerating static routes at build time.

---

## 4. Proxy Implementation Findings

The lazy Proxy in `src/lib/db.ts` is working correctly:

| Aspect | Finding |
|--------|---------|
| Model property access (e.g., `db.product`) | ✅ Correctly triggers client creation on first access |
| Prisma methods (e.g., `db.product.findMany()`) | ✅ Methods are on the real client, not re-proxied |
| Promise-related properties (`then`) | ✅ Not accessed on the Proxy directly |
| Object inspection | ✅ Proxy only intercepts `get`; returns real client properties |
| Symbols/framework introspection | ✅ `PropertyKey` type handles `string \| symbol` |
| PrismaAdapter compatibility | ✅ Verified — `PrismaAdapter(db)` works at runtime |
| Singleton initialization | ✅ `clientInstance` cached; dev uses `globalThis` singleton |
| Concurrent first-time access | ✅ Single `clientInstance` assignment (Node.js is single-threaded) |
| Client reuse across requests | ✅ Module-level `clientInstance` persists |

**No changes needed to the Proxy implementation.** It correctly defers client creation until first database access. The issue was solely that `generateStaticParams()` runs at build time and performs database access.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/app/collections/[category]/page.tsx` | Added DATABASE_URL/DIRECT_URL guard in `generateStaticParams()` — returns `[]` when credentials missing |
| `src/app/product/[id]/page.tsx` | Added DATABASE_URL/DIRECT_URL guard in `generateStaticParams()` — returns `[]` when credentials missing |

No changes to `src/lib/db.ts`, `src/lib/products.ts`, `src/auth.ts`, or any API routes.

---

## 6. Build Without Database Credentials

### Test method:

```bash
rm -rf .next
unset DATABASE_URL
unset DIRECT_URL
npm run build
```

### Result:

| Check | Result |
|-------|--------|
| Next.js compilation | PASS |
| TypeScript type-checking | PASS |
| Page-data collection | PASS |
| API route module imports | PASS |
| Database queries during build | NONE |
| Static category routes generated | NONE (returns `[]`) |
| Static product routes generated | NONE (returns `[]`) |
| Build exit code | 0 |

**Behavior:** Without DATABASE_URL, `generateStaticParams()` returns `[]`, so no static routes are generated at build time. Collection and product pages render at request time (when DATABASE_URL is available in the Netlify runtime environment).

---

## 7. Build With Test Database Credentials

### Test method:

```bash
rm -rf .next
DATABASE_URL="postgresql://sarthak@localhost:5432/aurashop_checkout_test_cba2a23f"
DIRECT_URL="postgresql://sarthak@localhost:5432/aurashop_checkout_test_cba2a23f"
npm run build
```

### Result:

| Check | Result |
|-------|--------|
| Next.js compilation | PASS |
| Static category routes | ACCESSORY, ARTIFACT, GEAR, OUTERWEAR, TECH |
| Static product routes | modula-shoulder-harness, obsidian-technical-boot, +19 more |
| Build exit code | 0 |

**Behavior:** With DATABASE_URL, `generateStaticParams()` works normally — all static routes are generated at build time as before.

---

## 8. Runtime Database Verification

### Test method:

Direct Prisma queries against isolated test database (`aurashop_checkout_test_cba2a23f`):

| Check | Result | Details |
|-------|--------|---------|
| SELECT products | PASS | count = 21 |
| Product listing | PASS | 12 products returned |
| Category filtering | PASS | 5 categories: ACCESSORY, ARTIFACT, GEAR, OUTERWEAR, TECH |
| Product detail by slug | PASS | CORE_SHELL (slug: core-shell) |
| Transaction handling | PASS | `db.$transaction()` executes successfully |
| Address CRUD | PASS | Create, find, delete all work |
| Customer ownership isolation | PASS | User sees own addresses only; other user sees none |
| PrismaAdapter compatibility | PASS | `adapter.getUserByEmail()` finds user correctly |

**Note:** `getProducts()`, `getCategories()`, and `getProductBySlug()` use `'use cache'` which requires Next.js cache components context. These are verified through Playwright E2E tests (42/42 pass), which exercise these functions through actual HTTP requests.

---

## 9. Regression Test Results

| Check | Result | Details |
|-------|--------|---------|
| `npx tsc --noEmit` | PASS | 0 type errors |
| `npm run lint` | PASS | 0 errors, 18 pre-existing warnings |
| `npm test` | PASS | 86/86 unit tests pass |
| `npm run build` (with DB) | PASS | Production build succeeds |
| `npm run build` (without DB) | PASS | Credential-free build succeeds |
| `npm audit --omit=dev` | PASS | 0 vulnerabilities |
| Playwright E2E suite | PASS | 42/42 tests pass |
| `npx prisma validate` | PASS | Schema valid |
| `npx prisma generate` | PASS | Client generated |
| `npx prisma migrate status` | PASS | Schema up to date |

---

## 10. Remaining Netlify Deployment Requirements

| Item | Status | Notes |
|------|--------|-------|
| Netlify account | NOT CREATED | Blocked by zero-cost constraints (no external accounts) |
| `DATABASE_URL` in Netlify | NOT SET | Must be added in Netlify dashboard (pooled connection string) |
| `DIRECT_URL` in Netlify | NOT SET | Must be added in Netlify dashboard (direct connection string for migrations) |
| `NEXTAUTH_SECRET` | NOT SET | Required for Auth.js |
| `NEXTAUTH_URL` | NOT SET | Must match Netlify deployment URL |
| Google OAuth callback URL | NOT SET | Must be updated in Google Cloud Console for production domain |
| Resend domain verification | NOT DONE | `vexo.store` not verified on Resend |
| Razorpay credentials | MISSING | Optional — COD works without it |
| Database migration (`npx prisma migrate deploy`) | NOT RUN | Must be run against production database after credentials configured |
| Actual Netlify deployment | NOT PERFORMED | Blocked by zero-cost constraints |

---

## Local vs Netlify Verification Distinction

| Verification Type | Status | Scope |
|-------------------|--------|-------|
| **Local build without DATABASE_URL** | VERIFIED | Build succeeds; `generateStaticParams()` returns `[]`; no database queries during build |
| **Local build with test DATABASE_URL** | VERIFIED | Build succeeds; all static routes generated |
| **Local runtime with test DATABASE_URL** | VERIFIED | All 7 database checks pass; 42/42 Playwright tests pass |
| **Actual Netlify deployment** | NOT VERIFIED | Requires Netlify account, database provisioning, and environment variable configuration (blocked by zero-cost constraints) |

---

## Summary

The build failure on `/collections/[category]` was caused by `generateStaticParams()` executing database queries at build time without `DATABASE_URL`. The fix adds a guard in both `generateStaticParams()` functions (collection and product pages) to return `[]` when database credentials are unavailable, allowing pages to render at request time instead of build time.

The lazy Prisma Proxy in `src/lib/db.ts` is working correctly and required no changes. All regression tests pass (42/42 Playwright, 86/86 unit tests, TypeScript, ESLint, build, audit).

**Working tree state:** Changes to `src/app/collections/[category]/page.tsx` and `src/app/product/[id]/page.tsx` remain uncommitted/untracked. `.env.local` was not modified. No commits or pushes occurred.
