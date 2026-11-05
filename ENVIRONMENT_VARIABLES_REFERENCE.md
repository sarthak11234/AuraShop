# ENVIRONMENT_VARIABLES_REFERENCE

**Project:** AuraShop / VEXO
**Phase:** 14 — Release Candidate & Functional Stabilization

This document lists all environment variables used by the application, their purpose, and their configuration status.

**Never include actual credentials or secrets in this document.**

---

## 1. Required Variables

| Variable | Purpose | Status | Example Format |
|----------|---------|--------|----------------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma/node-postgres via `@prisma/adapter-pg`) | REQUIRED | `postgresql://user@localhost:5432/db` |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations) | REQUIRED | `postgresql://user@localhost:5432/db` |
| `NEXTAUTH_SECRET` | Auth.js session encryption secret | REQUIRED | 32+ random characters |
| `NEXTAUTH_URL` | Base URL of the application (Auth.js callback domain) | REQUIRED | `https://your-domain.com` |

---

## 2. Authentication Variables

| Variable | Purpose | Status | Details |
|----------|---------|--------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | CONFIGURED | Used for Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | CONFIGURED | Used for Google sign-in |
| `RESEND_API_KEY` | Resend email API key | CONFIGURED | Used for magic-link, welcome, order, return, refund emails |

**Authentication providers:** Google OAuth, GitHub OAuth, Resend magic-link. No Credentials provider — password management is unavailable.

---

## 3. Payment Variables

| Variable | Purpose | Status | Details |
|----------|---------|--------|---------|
| `RAZORPAY_KEY_ID` | Razorpay API key ID | MISSING CREDENTIALS | Not set — Razorpay gracefully unavailable |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret | MISSING CREDENTIALS | Not set — Razorpay gracefully unavailable |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook verification secret | MISSING CREDENTIALS | Not set |

**Razorpay behavior without credentials:** API returns `{"available":false}`, checkout UI shows "not configured", Razorpay payment radio disabled. COD remains fully functional.

---

## 4. Email/Domain Variables

| Variable | Purpose | Status | Details |
|----------|---------|--------|---------|
| `RESEND_FROM_EMAIL` | Sender email address | CONFIGURED | Must use a verified Resend domain |
| `RESEND_DOMAIN` | Resend-sending domain | NOT CONFIGURED | Domain `vexo.store` not verified on Resend |

**Email status:** All email templates implemented (welcome, magic-link, order confirmation, return, refund). Delivery requires Resend domain verification.

---

## 5. Application Variables

| Variable | Purpose | Status | Details |
|----------|---------|--------|---------|
| `NEXT_PUBLIC_APP_URL` | Public application URL | CONFIGURED | Used for email links and OAuth callbacks |
| `MANUAL_SHIPPING_PROVIDER` | Manual shipping provider name | CONFIGURED | Set to "Manual" for admin tracking |
| `NODE_ENV` | Node.js environment | CONFIGURED | `production` for production builds |

---

## 6. Database Variables

| Variable | Purpose | Status | Details |
|----------|---------|--------|---------|
| `DATABASE_URL` | Primary database URL | REQUIRED | Used by Prisma client at runtime |
| `DIRECT_URL` | Direct database URL | REQUIRED | Used by Prisma migrations |
| `CHECKOUT_TEST_DATABASE_URL` | Isolated test database URL | TEST ONLY | Used by Playwright E2E tests; must contain `checkout_test` in database name |

---

## 7. Variable Configuration Status Summary

| Category | Variables | Configured | Verified | Blocked |
|----------|-----------|------------|----------|---------|
| Required (core) | DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL | ✅ | ✅ (local) | ❌ (production) |
| Authentication | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, RESEND_API_KEY | ✅ | ❌ (production callback unset) | — |
| Payment | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET | ❌ | — | ❌ (missing credentials) |
| Email domain | RESEND_FROM_EMAIL, RESEND_DOMAIN | ⚠️ | ❌ (domain not verified) | — |

---

## 8. Important Notes

- **`.env.local` was not modified** during this phase (per zero-cost constraints).
- All credentials are configured locally but **not verified in production** (no deployment performed).
- Razorpay credentials are intentionally absent — the application gracefully degrades to COD-only when Razorpay is unavailable.
- Resend domain `vexo.store` must be verified on Resend before email delivery works in production.
- Google OAuth callback URL must be set to `https://<production-domain>/api/auth/callback/google` in Google Cloud Console.
