'use client';

import React from 'react';
import Link from 'next/link';
import { useWishlistStore } from '@/store/wishlistStore';
import { ProductGrid } from '@/components/product/ProductGrid';

export function WishlistContent() {
  const [hydrated, setHydrated] = React.useState(false);
  const items = useWishlistStore((state) => state.items);

  React.useEffect(() => {
    const unsubscribe = useWishlistStore.persist.onFinishHydration(() => setHydrated(true));
    if (useWishlistStore.persist.hasHydrated()) {
      queueMicrotask(() => setHydrated(true));
    }
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen px-5 pb-24 pt-28 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1600px]">
        <p className="font-mono text-[10px] font-bold tracking-widest text-brand">VEXO / SAVED FOR LATER</p>
        <div className="mb-10 mt-2 flex items-baseline justify-between gap-4 border-b border-line pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl">WISHLIST</h1>
          <span className="font-mono text-xs text-ink-secondary">
            {hydrated ? `${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'}` : 'LOADING'}
          </span>
        </div>

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
