import type { ReactNode } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { AccountNav } from '@/components/account/AccountNav';

// Every account route resolves the authenticated session and live database
// state per request. This segment is intentionally blocking.
export const instant = false;

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // Prevent a static shell from being flushed before authentication and
  // ownership checks run. Without this, `notFound()` cannot set a 404 status
  // and Auth.js generates CSRF tokens during prerendering.
  await connection();

  return (
    <main className="min-h-screen bg-canvas px-4 pb-24 pt-28 text-ink-primary sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-line pb-6">
          <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-brand">
            VEXO / ACCOUNT
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              MY ACCOUNT
            </h1>
            <Link
              href="/collections"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:text-brand"
            >
              Continue shopping →
            </Link>
          </div>
        </header>
        <AccountNav />
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
