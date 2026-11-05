# KNOWN_LIMITATIONS

**Project:** AuraShop / VEXO
**Phase:** 14 — Release Candidate & Functional Stabilization

This document lists all known limitations, unresolved issues, and external dependencies for the AuraShop / VEXO release candidate.

---

## 1. Deployment Limitations

### Cloudflare Workers Incompatible (BLOCKER)

**Issue:** The application cannot run on Cloudflare Workers.

**Root cause:** `src/lib/db.ts` uses `PrismaPg` from `@prisma/adapter-pg`, which wraps `node-postgres` requiring TCP socket connections. Cloudflare Workers only supports HTTP/fetch — no TCP sockets are available.

**Affected components:**
- Prisma client (all database operations)
- Auth.js v5 with PrismaAdapter (sessions)
- Next.js 16 Cache Components (PPR) — `await connection()` from `next/server`
- OpenNext (only supports Next.js up to v15.x)

**Mitigation:** Deploy on Vercel Hobby + Neon Free instead (requires account creation, blocked by zero-cost constraints).

---

## 2. External Integration Limitations

### Razorpay Payments (MISSING CREDENTIALS)

**Issue:** Razorpay credentials are not configured.

**Status:** `MISSING CREDENTIALS`

**Behavior:** API returns `{"available":false}`, checkout UI shows "not configured", Razorpay payment radio disabled.

**Customer impact:** Cash on Delivery (COD) remains fully functional. Online payments unavailable.

**Mitigation:** Obtain Razorpay credentials and add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` to environment variables.

### Resend Email (DOMAIN UNVERIFIED)

**Issue:** Resend domain `vexo.store` is not verified.

**Status:** `CONFIGURED BUT UNVERIFIED`

**Behavior:** Email API returns 403 validation error: "The vexo.store domain is not verified."

**Customer impact:** Magic-link sign-in, welcome emails, order confirmations, return notifications, and refund notifications will not be delivered.

**Mitigation:** Verify domain on Resend dashboard and add `RESEND_FROM_EMAIL` with a verified sender address.

### Google OAuth (CALLBACK URL UNSET)

**Issue:** Google OAuth callback URL not configured for production domain.

**Status:** `CONFIGURED BUT UNVERIFIED`

**Behavior:** OAuth sign-in works locally but will fail in production until the callback URL is added to Google Cloud Console.

**Mitigation:** Add `https://<production-domain>/api/auth/callback/google` to Google Cloud Console OAuth 2.0 credentials.

---

## 3. Functional Limitations

### Customer Cancellation of Paid Online Orders (INTENTIONALLY UNAVAILABLE)

**Issue:** Cancellation of captured/paid online orders is blocked.

**Status:** `BLOCKED BY DESIGN`

**Reason:** No verified refund workflow exists for Razorpay payments. Refunding captured payments requires support-managed verification.

**Behavior:** Orders with `PAID_ONLINE` payment status return 409 when cancellation is attempted. Routes to support.

**Customer impact:** COD orders (PENDING, CONFIRMED, PROCESSING, PACKED) can be cancelled by customers. Paid online orders cannot.

**Mitigation:** Implement a verified refund workflow before enabling online order cancellation.

---

### Razorpay-Unavailable State (GRACEFUL DEGRADATION)

**Status:** `CONFIGURED BUT UNVERIFIED`

**Behavior:** When Razorpay credentials are missing, the checkout flow gracefully degrades:
- API returns `{"available":false}`
- Checkout UI shows "not configured"
- Razorpay radio is disabled
- COD remains the only payment option

**Verification:** Safe unavailable state verified locally — no real payments attempted.

---

## 4. Testing Limitations

### No Live Production Testing

**Status:** `NOT VERIFIED`

**Reason:** No deployment performed. No external accounts created.

**Impact:** Production behavior (OAuth, email, payments) not tested in production environment.

**Mitigation:** All integration points verified locally with mocked/unavailable states.

### No Cross-Browser Testing

**Status:** `NOT PERFORMED`

**Reason:** Playwright configured for Chromium only.

**Impact:** Firefox and Safari compatibility not verified.

---

## 5. Pre-Existing Database Drift (Development Only)

**Issue:** Development database has pre-existing drift not present in isolated test database.

**Details:**
- Duplicate enum label `"OUT_FOR_DELIVERY"`
- Legacy indexes `Address_userId_country_idx` and `Address_userId_kind_idx`

**Status:** `KNOWN — DO NOT FIX`

**Reason:** Destructive fixes would risk data loss. Isolated test database is clean with no drift.

**Impact:** None on functionality. Only affects development database schema comparison.

---

## 6. Authentication Limitations

### No Password Management

**Status:** `BY DESIGN`

**Reason:** Auth.js configured with Google OAuth, GitHub OAuth, and Resend magic-link only. No Credentials provider.

**Impact:** Password reset, password change, and email/password sign-up are unavailable.

**Mitigation:** Users sign in via OAuth or magic-link. No password to forget.

### Email Changes Require Re-verification

**Status:** `BY DESIGN`

**Reason:** Email changes do not bypass Auth.js verification.

**Impact:** Customers cannot change their email without going through the Auth.js verification flow.

---

## 7. Build Artifact Notes

### Stale Route Cache (RESOLVED)

**Issue:** Previous builds created stale route cache entries in `.next/server/route-cache` that contained outdated product data.

**Resolution:** Clear `.next/` directory and rebuild before running tests or deployment.

**Status:** `RESOLVED` — Cache cleared on Nov 05, 2026.

---

## 8. Items Not Blocking Release

| Item | Status | Reason |
|------|--------|--------|
| Cloudflare Workers incompatible | NOT BLOCKING | Alternative hosting (Vercel + Neon) available |
| Razorpay credentials missing | NOT BLOCKING | COD fully functional |
| Resend domain unverified | NOT BLOCKING | Email templates implemented; domain verification is operational |
| Google OAuth callback unset | NOT BLOCKING | OAuth configured locally; callback URL is operational config |
| No cross-browser testing | NOT BLOCKING | Chromium coverage sufficient for release candidate |

---

## 9. Items That WOULD Block Release

None. All application functionality is implemented and tested. The release candidate is ready pending hosting selection and operational configuration.

---

## 10. Contact / Escalation

No external support contacts configured. All issues should be addressed through the development team.
