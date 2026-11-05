This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Admin operations

Administrative pages require a verified account with the `ADMIN` or `SUPER_ADMIN` role. Admin roles cannot be assigned from a public route.

To provision an administrator:

1. Sign in through a configured VEXO authentication provider and verify the account email.
2. Apply the additive schema migration in a deployment window with `npx prisma migrate deploy`; do not reset the database.
3. From a trusted operator environment with database access, run:

   ```sh
   PROMOTE_ADMIN_EMAIL=operator@example.com npm run admin:promote
   ```

   The command promotes only one existing verified account to `ADMIN`. To provision the initial super administrator, explicitly set `PROMOTE_ADMIN_ROLE=SUPER_ADMIN`.
4. Configure `LOW_STOCK_THRESHOLD` if the default of 5 units is not appropriate.

The admin app currently supports catalogue, category, inventory, order-status, customer-read, and audit-log operations. Payments/refunds, shipping addresses, and payment collection status are not present in the current Prisma data model; the dashboard labels those metrics unavailable and does not infer revenue or payment success from order totals.
