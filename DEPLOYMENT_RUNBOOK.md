# DEPLOYMENT_RUNBOOK

**Project:** AuraShop / VEXO
**Phase:** 14 — Release Candidate & Functional Stabilization

**Zero-cost constraint:** No paid infrastructure, no credit card, no external accounts, no deployment performed.

This runbook documents the deployment procedure for when credentials and accounts become available.

---

## 1. Prerequisites

Before deployment, the following must be available:

| Prerequisite | Status | Notes |
|-------------|--------|-------|
| Hosting account (Vercel Hobby recommended) | NOT CREATED | Cannot create per zero-cost constraints |
| Database (Neon Free recommended) | NOT CREATED | Cannot create per zero-cost constraints |
| Email service (Resend) | CONFIGURED (API key) | Domain not verified |
| OAuth (Google/GitHub) | CONFIGURED (credentials) | Callback URL not set for production |
| Payment (Razorpay) | MISSING CREDENTIALS | Optional — COD works without it |
| GitHub repository | NOT CONNECTED | Cannot connect per zero-cost constraints |

---

## 2. Recommended Hosting Architecture

| Component | Platform | Tier | Cost | Reason |
|-----------|----------|------|------|--------|
| Application | Vercel | Hobby | $0 | Native Next.js 16 support |
| Database | Neon | Free | $0 | PostgreSQL-compatible, Prisma-compatible |
| Email | Resend | Free | $0 | 3,000 emails/month |
| OAuth | Google/GitHub | Free | $0 | Existing credentials |

**Cloudflare Workers is NOT compatible** — Prisma requires TCP sockets; Workers only support HTTP/fetch.

---

## 3. Deployment Procedure

### Step 1: Create Database

1. Create a Neon project at neon.com (Free tier)
2. Obtain the connection string
3. Run `npx prisma migrate deploy` against the production database
4. Run `npx prisma generate` to regenerate the Prisma client

### Step 2: Create Hosting Account

1. Create a Vercel account at vercel.com (Hobby tier)
2. Connect the GitHub repository
3. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
   - Install command: `npm install`

### Step 3: Configure Environment Variables

Add the following to the Vercel project settings:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon connection string |
| `DIRECT_URL` | Neon direct connection string |
| `NEXTAUTH_SECRET` | 32+ random characters |
| `NEXTAUTH_URL` | `https://<vercel-deployment-url>` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `RESEND_API_KEY` | From Resend dashboard |
| `RESEND_FROM_EMAIL` | Verified sender email |
| `NEXT_PUBLIC_APP_URL` | `https://<vercel-deployment-url>` |

### Step 4: Configure External Services

1. **Resend:** Verify domain `vexo.store` (or your domain) in Resend dashboard
2. **Google OAuth:** Add callback URL `https://<vercel-url>/api/auth/callback/google` in Google Cloud Console
3. **Razorpay:** (Optional) Add credentials if online payments are needed; otherwise COD works without it

### Step 5: Deploy

1. Push to GitHub → Vercel auto-deploys
2. Verify deployment at the Vercel URL

### Step 6: Post-Deployment Verification

| Check | Command/Action |
|-------|----------------|
| Homepage loads | Visit `https://<vercel-url>/` |
| Catalogue browsing | Visit `https://<vercel-url>/collections` |
| Product detail | Visit `https://<vercel-url>/product/<slug>` |
| COD checkout | Create test order with COD |
| Customer account | Sign in and visit `/account` |
| Admin access | Sign in as admin and visit `/admin` |
| Email delivery | Check Resend dashboard for sent emails |

---

## 4. Rollback Procedure

1. **Application rollback:** Vercel supports instant rollback to previous deployment via dashboard
2. **Database rollback:** Neon supports point-in-time recovery (Free tier limited)
3. **Migration rollback:** Prisma migrations are additive only — no destructive migrations

---

## 5. Health Checks

| Endpoint | Expected | Purpose |
|----------|----------|---------|
| `/` | 200 OK | Homepage loads |
| `/api/products?category=TECH` | 200 OK | Catalogue API works |
| `/account` | 200 OK (redirect if not signed in) | Account routes work |
| `/admin` | 200 OK (redirect if not admin) | Admin routes work |

No dedicated health check endpoint exists. Use the homepage or a simple API route for load balancer health checks.

---

## 6. Monitoring

No external monitoring configured. Application logs are available via the hosting provider (Vercel function logs).

Key metrics to monitor:
- Page load times
- API error rates
- Database connection pool usage
- Email delivery failures (Resend dashboard)

---

## 7. Incident Response

| Incident | Response |
|----------|----------|
| Database unavailable | Check Neon status; verify connection string |
| Email delivery fails | Check Resend domain verification; check API key |
| OAuth fails | Verify callback URL in Google Cloud Console |
| Razorpay unavailable | COD remains functional; verify credentials if needed |
| Build fails | Run `npm run build` locally; check TypeScript and lint |

---

## 8. What Cannot Be Done (Zero-Cost Constraints)

- No credit card for identity verification on hosting platforms
- No external account creation
- No deployment to production
- No paid infrastructure or trials

Deployment must be performed by someone with the ability to create accounts and add environment variables.
