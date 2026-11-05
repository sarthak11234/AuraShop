'use client';

import React from 'react';
import Link from 'next/link';
import type { ProductCardData } from '@/lib/products';
import { useWishlistStore } from '@/store/wishlistStore';
import { ProductGrid } from '@/components/product/ProductGrid';

type RefreshState = 'idle' | 'loading' | 'ready' | 'error';

export function WishlistContent({ embedded = false }: { embedded?: boolean }) {
  const [hydrated, setHydrated] = React.useState(false);
  const [refreshState, setRefreshState] = React.useState<RefreshState>('idle');
  const items = useWishlistStore((state) => state.items);
  const replaceItems = useWishlistStore((state) => state.replaceItems);
  const idsKey = items
    .map((item) => item.id)
    .sort()
    .join(',');

  React.useEffect(() => {
    const unsubscribe = useWishlistStore.persist.onFinishHydration(() => setHydrated(true));
    if (useWishlistStore.persist.hasHydrated()) {
      queueMicrotask(() => setHydrated(true));
    }
    return unsubscribe;
  }, []);

  // Wishlist items are persisted in the browser, so their catalogue snapshot can
  // go stale. Refresh availability from the real product records without
  // dropping unavailable items — the customer decides when to remove them.
  React.useEffect(() => {
    if (!hydrated || !idsKey) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setRefreshState('loading');
    });

    fetch(`/api/products?ids=${encodeURIComponent(idsKey)}`)
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) throw new Error('Availability request failed');
        if (
          !result ||
          typeof result !== 'object' ||
          !('products' in result) ||
          !Array.isArray(result.products)
        ) {
          throw new Error('Availability response was invalid');
        }
        return result.products as ProductCardData[];
      })
      .then((products) => {
        if (!active) return;
        const byId = new Map(products.map((product) => [product.id, product]));
        const current = useWishlistStore.getState().items;
        const refreshed = current.map((item) => {
          const product = byId.get(item.id);
          if (product) return product;
          return {
            ...item,
            inStock: false,
            variants: item.variants.map((variant) => ({ ...variant, stock: 0 })),
          };
        });
        if (JSON.stringify(refreshed) !== JSON.stringify(current)) {
          replaceItems(refreshed);
        }
        setRefreshState('ready');
      })
      .catch(() => {
        if (active) setRefreshState('error');
      });

    return () => {
      active = false;
    };
  }, [hydrated, idsKey, replaceItems]);

  const Heading = embedded ? 'h2' : 'h1';
  const visibleRefreshState = idsKey ? refreshState : 'idle';

  return (
    <div className={embedded ? '' : 'min-h-screen px-5 pb-24 pt-28 sm:px-8 lg:px-12'}>
      <div className={embedded ? '' : 'mx-auto max-w-[1600px]'}>
        <p className="font-mono text-[10px] font-bold tracking-widest text-brand">
          VEXO / SAVED FOR LATER
        </p>
        <div className="mb-8 mt-2 flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-5">
          <Heading className="font-display text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
            WISHLIST
          </Heading>
          <span className="font-mono text-xs text-ink-secondary" aria-live="polite">
            {hydrated ? `${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'}` : 'LOADING'}
          </span>
        </div>

        {visibleRefreshState === 'loading' && (
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Refreshing availability…
          </p>
        )}
        {visibleRefreshState === 'error' && (
          <p role="status" className="mb-4 border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
            Availability could not be refreshed. Your saved pieces are unchanged, but stock
            shown below may be out of date.
          </p>
        )}

        {!hydrated ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-label="Loading wishlist">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="aspect-[4/5] animate-pulse bg-surface" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <ProductGrid products={items} />
        ) : (
          <div className="flex min-h-[45vh] flex-col items-center justify-center border border-line bg-surface px-6 text-center">
            <p className="font-mono text-[10px] tracking-[0.18em] text-brand">NO SAVED PIECES</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-ink-secondary">
              Save pieces as you explore the VEXO catalogue and they will appear here.
            </p>
            <Link
              href="/collections"
              className="mt-6 inline-flex min-h-12 items-center justify-center bg-brand px-6 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              EXPLORE COLLECTIONS
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
