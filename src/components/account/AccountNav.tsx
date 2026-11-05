'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Overview', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Addresses', href: '/account/addresses' },
  { label: 'Returns', href: '/account/returns' },
  { label: 'Wishlist', href: '/account/wishlist' },
  { label: 'Profile', href: '/account/profile' },
  { label: 'Settings', href: '/account/settings' },
] as const;

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="border-b border-line">
      <ul className="flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/account'
              ? pathname === '/account'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center border-b-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors',
                  active
                    ? 'border-brand text-ink-primary'
                    : 'border-transparent text-ink-secondary hover:border-line hover:text-ink-primary',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
