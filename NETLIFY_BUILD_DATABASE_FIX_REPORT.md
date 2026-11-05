# NETLIFY BUILD DATABASE FIX REPORT

**Project:** AuraShop / VEXO
**Phase:** Netlify Deployment Fix — Prisma Database Initialization
**Date:** Fri Nov 06 2026

---

## 1. Root Cause

The build-time database initialization failure was caused by **eager PrismaClient instantiation** in `src/lib/db.ts`:

```typescript
// BEFORE (problematic):
export const db: PrismaClient = globalForPrisma.prisma ?? createClient();
```

`createClient()` is called at **module load time**, which:
1. Reads `DATABASE_URL` / `DIRECT_URL` from `process.env`
2. Throws `Error('Database connection string is missing...')` if absent
3. Creates a `PrismaPg` adapter wrapping `node-postgres`, which attempts to establish a TCP connection

During Netlify's `npm run build`, Next.js imports all API route and page modules for **page-data collection**. These modules transitively import `src/lib/db.ts` (46+ server files, 19+ page files). Since Netlify's build environment does not have `DATABASE_URL` set (database is provisioned separately at runtime), the module-level `createClient()` call throws, aborting the build at:

```
Failed to collect configuration for /api/account/addresses/[addressId]
Database connection string is missing. Please set DATABASE_URL or DIRECT_URL.
```

This is not limited to the address route — **every** database-backed route and page module triggers the same failure during build.

### Affected Files (46 server + 19 page imports of `@/lib/db`)

**Server/API routes (46):**
- `src/app/api/account/addresses/[addressId]/route.ts`
- `src/app/api/account/addresses/route.ts`
- `src/app/api/account/profile/route.ts`
- `src/app/api/account/returns/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/payment/cod/route.ts`
- `src/app/api/payment/razorpay/route.ts`
- `src/app/api/payment/razorpay/verify/route.ts`
- `src/app/api/payment/razorpay/fail/route.ts`
- `src/app/api/payment/razorpay/webhook/route.ts`
- `src/app/api/orders/route.ts`
- `src/app/api/admin/*` (multiple routes)
- `src/app/api/algolia/sync/route.ts`

**Server pages (19):**
- `src/app/account/profile/page.tsx`
- `src/app/account/returns/page.tsx`
- `src/app/account/returns/[returnId]/page.tsx`
- `src/app/account/settings/page.tsx`
- `src/app/admin/(dashboard)/page.tsx`
- `src/app/admin/(dashboard)/layout.tsx`
- `src/app/admin/(dashboard)/*` (multiple pages)
- `src/app/admin/returns/page.tsx`
- `src/app/admin/returns/[returnId]/page.tsx`

**Auth.js (`src/auth.ts`):**
- Imports `db` and passes it to `PrismaAdapter(db)` at module scope

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/lib/db.ts` | Refactored from eager PrismaClient instantiation to lazy Proxy-based initialization |

No other files were modified. All existing imports of `db` from `@/lib/db` continue to work unchanged.

---

## 3. Database Initialization Changes

### Before (Eager Initialization)

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error('Database connection string is missing...');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log: [...] });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

**Problem:** `createClient()` runs at module import time. Missing `DATABASE_URL` throws immediately, breaking builds without database credentials.

### After (Lazy Initialization via Proxy)

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let clientInstance: PrismaClient | null = null;

function createClient(): PrismaClient {
  // Same as before — reads connection string, throws if missing
  // But only called on first database access, not at import time
}

function getOrCreateClient(): PrismaClient {
  if (clientInstance) return clientInstance;
  if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
    clientInstance = globalForPrisma.prisma;
    return clientInstance;
  }
  clientInstance = createClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = clientInstance;
  }
  return clientInstance;
}

const db = new Proxy({} as PrismaClient, {
  get(_target, prop: PropertyKey) {
    const client = getOrCreateClient();
    return (client as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export { db };
```

### Design Properties

| Requirement | Implementation |
|-------------|---------------|
| Importing db module does not require DATABASE_URL | ✅ Proxy defers client creation to first property access |
| Importing API route does not instantiate PostgreSQL connection | ✅ `createClient()` not called at module scope |
| PrismaClient creation on first database access | ✅ `getOrCreateClient()` called on first `db.xxx` property access |
| Missing DATABASE_URL produces clear error at point of access | ✅ `createClient()` throws on first actual database operation |
| Existing Prisma singleton behavior preserved | ✅ `clientInstance` caches the client; dev uses `globalThis` singleton |
| Dev hot reload doesn't create unnecessary clients | ✅ `globalForPrisma.prisma` reused across hot reloads |
| Production requests reuse client/pool lifecycle | ✅ `clientInstance` module-level cache persists across requests |
| Prisma adapter configuration remains intact | ✅ `PrismaAdapter(db)` receives the Proxy; works identically at runtime |

### Auth.js Compatibility

`src/auth.ts` imports `db` and passes it to `PrismaAdapter(db)`:

```typescript
import { db } from '@/lib/db';
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  ...
});
```

**Finding:** Auth.js is fully compatible with the lazy Proxy. `PrismaAdapter` only calls `db.user.findUnique()`, `db.session.create()`, etc. when handling actual authentication requests — never at module load time. The Proxy defers client creation until the first Auth.js database operation occurs at runtime. No changes to `src/auth.ts` were needed.

---

## 4. Route Runtime Behavior

All database-backed API routes execute queries only when a request invokes the handler:

- **GET /api/account/addresses/[addressId]** — queries only on request ✅
- **PATCH /api/account/addresses/[addressId]** — writes only on request ✅
- **DELETE /api/account/addresses/[addressId]** — deletes only on request ✅

No database queries execute at module scope. Authentication and ownership checks remain intact (they run inside the handler, after the lazy client is created).

No `connection()` calls were added to API routes. Next.js does not attempt to prerender request-dependent API behavior — API routes are dynamic (handlers run at request time, not build time).

---

## 5. Build Without Database Credentials

### Test Method

Clean production build with `DATABASE_URL` and `DIRECT_URL` absent from the environment:

```bash
rm -rf .next
unset DATABASE_URL
unset DIRECT_URL
npm run build
```

### Result

| Check | Result |
|-------|--------|
| Next.js compilation | PASS |
| TypeScript type-checking | PASS |
| Page-data collection | PASS |
| API route module imports | PASS |
| Database queries during build | NONE (client never created) |
| Build exit code | 0 |

The previously failing route `/api/account/addresses/[addressId]` now imports successfully without a database connection string. All other API routes and pages also import successfully.

---

## 6. Runtime Database Test Results

### Test Method

Runtime verification against the isolated test database (`aurashop_checkout_test_cba2a23f`):

```bash
DATABASE_URL="postgresql://sarthak@localhost:5432/aurashop_checkout_test_cba2a23f" \
npx tsx verify-runtime-db.ts
```

### Results

| Check | Result |
|-------|--------|
| Prisma initialization (lazy client creation) | PASS |
| Database SELECT (`db.user.count()`) | PASS |
| Database INSERT (`db.user.create()`) | PASS |
| Database INSERT + cleanup (`db.user.delete()`) | PASS |
| Transaction handling (`db.$transaction()`) | PASS |
| Address CRUD (create, update) | PASS |
| Customer ownership isolation | PASS |
| Authentication via PrismaAdapter (`getUserByEmail`) | PASS |
| **Overall** | **PASS** |

---

## 7. Regression Test Results

All previously passing tests remain passing after the fix:

| Check | Result | Details |
|-------|--------|---------|
| `npx tsc --noEmit` | PASS | 0 type errors |
| `npm run lint` | PASS | 0 errors, 18 pre-existing warnings |
| `npm test` | PASS | 86/86 unit tests pass |
| `npm run build` | PASS | Production build succeeds |
| `npm audit --omit=dev` | PASS | 0 vulnerabilities |
| Playwright E2E suite | PASS | 42/42 tests pass |
| `npx prisma validate` | PASS | Schema valid |
| `npx prisma generate` | PASS | Client generated |
| `npx prisma migrate status` | PASS | Schema up to date |

---

## 8. Remaining Deployment Requirements

For actual Netlify deployment, the following must be configured:

| Item | Status | Notes |
|------|--------|-------|
| Netlify account | NOT CREATED | Blocked by zero-cost constraints (no external accounts) |
| PostgreSQL database (Netlify Postgres or external) | NOT PROVISIONED | Required for runtime database access |
| `DATABASE_URL` / `DIRECT_URL` environment variables | NOT SET | Must be added in Netlify dashboard |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | NOT SET | Required for Auth.js |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | CONFIGURED locally | OAuth callback URL must be updated for production domain |
| `RESEND_API_KEY` | CONFIGURED locally | Domain `vexo.store` not verified on Resend |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | MISSING | Optional — COD works without Razorpay |

### Build Command for Netlify

```bash
npm run build
```

This succeeds without `DATABASE_URL` (verified above). At runtime, Netlify must provide `DATABASE_URL` for database operations.

### Local vs Netlify Verification Distinction

| Verification Type | Status | Scope |
|-------------------|--------|-------|
| **Local build without DATABASE_URL** | VERIFIED | Build succeeds, no database queries during build |
| **Local runtime with DATABASE_URL** | VERIFIED | All database operations work via lazy client |
| **Actual Netlify deployment** | NOT VERIFIED | Requires Netlify account and database provisioning (blocked by zero-cost constraints) |

---

## 9. Strict Constraints Compliance

| Constraint | Status |
|------------|--------|
| Preserve existing architecture | ✅ Only `src/lib/db.ts` changed |
| Preserve Prisma 7 + PostgreSQL | ✅ No ORM replacement |
| Preserve Auth.js | ✅ No auth changes needed |
| Do not modify `.env.local` | ✅ Not modified |
| Do not expose credentials | ✅ No credentials in report |
| Do not introduce paid services | ✅ No paid services |
| Do not deploy | ✅ Not deployed |
| Do not commit or push | ✅ No commits/pushes |
| Do not remove existing functionality | ✅ All features preserved |
| Do not use fake database credentials | ✅ No dummy credentials used |

---

## Summary

The Netlify build failure was caused by eager PrismaClient instantiation at module load time in `src/lib/db.ts`. The fix refactors database initialization to use a **lazy Proxy** that defers `PrismaClient` creation until the first database operation is actually requested. This allows:

1. **Build without DATABASE_URL** — Next.js can import all modules without a database connection string
2. **Runtime with DATABASE_URL** — Database operations work normally via the lazily-created client
3. **Auth.js compatibility** — `PrismaAdapter(db)` works unchanged with the Proxy

All 42 Playwright tests, 86 unit tests, TypeScript, ESLint, build, Prisma validation, and npm audit pass after the fix.

**Working tree state:** Change to `src/lib/db.ts` remains uncommitted/untracked. `.env.local` was not modified. No commits or pushes occurred.
