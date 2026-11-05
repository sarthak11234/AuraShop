import Link from 'next/link';
import { signOut } from '@/auth';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';

// The operations dashboard depends on the authenticated session and live
// database state on every request. It is a blocking segment by design.
export const instant = false;

const navigation = [
  ['Overview', '/admin'],
  ['Orders', '/admin/orders'],
  ['Returns', '/admin/returns'],
  ['Products', '/admin/products'],
  ['Categories', '/admin/categories'],
  ['Inventory', '/admin/inventory'],
  ['Customers', '/admin/customers'],
  ['Payments', '/admin/payments'],
  ['Analytics', '/admin/analytics'],
  ['Activity log', '/admin/activity'],
  ['Settings', '/admin/settings'],
] as const;

function NavigationLinks() {
  return (
    <ul className="flex flex-col gap-1">
      {navigation.map(([label, href]) => (
        <li key={href}>
          <Link
            href={href}
            className="block border-l-2 border-transparent px-3 py-2 text-sm text-ink-secondary transition-colors hover:border-brand hover:bg-surface hover:text-ink-primary"
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function signOutAdmin() {
  'use server';
  await signOut({ redirectTo: '/' });
}

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await requireAdminPage();
  const pendingOrders = await db.order.count({ where: { status: 'PENDING' } });

  return (
    <div className="admin-shell min-h-screen bg-canvas text-ink-primary">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-line bg-canvas px-4 sm:px-6">
        <Link href="/admin" className="font-display text-sm font-bold tracking-[0.18em] text-brand">
          VEXO / ADMIN
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <form action="/admin/orders" className="hidden md:block">
            <label htmlFor="admin-global-search" className="sr-only">Search orders or customers</label>
            <input
              id="admin-global-search"
              name="q"
              placeholder="Search orders / customers"
              className="min-h-10 w-56 border border-line bg-surface px-3 text-xs placeholder:text-ink-muted"
            />
          </form>
          <Link href="/admin/orders?status=PENDING" className="hidden border border-line px-3 py-2 text-ink-secondary hover:border-brand sm:inline">
            Pending <span className="ml-1 font-mono text-brand">{pendingOrders}</span>
          </Link>
          <span className="hidden text-ink-secondary sm:inline">
            {actor.name || actor.email}
          </span>
          <span className="border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink-muted">
            {actor.role.replace('_', ' ')}
          </span>
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="min-h-10 border border-line px-3 text-xs text-ink-primary hover:border-brand"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] lg:flex">
        <details className="border-b border-line px-4 py-3 lg:hidden">
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">
            Admin navigation
          </summary>
          <nav aria-label="Admin navigation" className="pb-2 pt-3">
            <NavigationLinks />
          </nav>
        </details>

        <aside className="hidden w-60 shrink-0 border-r border-line px-4 py-6 lg:block">
          <nav aria-label="Admin navigation">
            <NavigationLinks />
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
