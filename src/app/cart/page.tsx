'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CartEmptyState,
  CartItemRow,
  CartOrderSummary,
  CheckoutLink,
} from '@/components/cart/CartContents';
import { useCartStore } from '@/store/cartStore';

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const router = useRouter();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <div className="min-h-screen px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/collections"
          className="inline-flex min-h-11 items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-secondary transition-colors hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Continue shopping
        </Link>

        <div className="mb-8 mt-8 border-b border-line pb-6 sm:mb-10">
          <p className="font-mono text-[10px] font-bold tracking-widest text-brand">VEXO / YOUR SELECTION</p>
          <div className="mt-2 flex items-baseline justify-between gap-4">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">CART</h1>
            <span className="font-mono text-xs text-ink-secondary">
              {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="min-h-[45vh] border border-line bg-surface">
            <CartEmptyState onContinueShopping={() => router.push('/collections')} />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
            <section aria-label="Cart items" className="space-y-3">
              {items.map((item) => <CartItemRow key={item.key} item={item} />)}
            </section>

            <aside className="h-fit space-y-5 border border-line bg-surface p-5 sm:p-6">
              <CartOrderSummary items={items} id="cart-page-order-summary" />
              <CheckoutLink />
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/collections')}
                className="min-h-11 w-full font-mono text-[10px] uppercase tracking-widest"
              >
                Continue shopping
              </Button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
