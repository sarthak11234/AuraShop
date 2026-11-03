import React from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────
// HeroProductCard — restrained floating product information over the 3D
// avatar. Rendered as a Server Component (streamed in via Suspense from the
// homepage) so the price always comes from the live catalogue, never from
// hardcoded values.
// ─────────────────────────────────────────────────────────────────────────

/** Minimal product shape the card needs (structural subset of Product). */
export interface HeroProductCardData {
  title: string;
  subtitle: string;
  slug: string;
  price: string; // formatted, e.g. "$840.00"
  category: string;
  categoryCode: string;
}

export function HeroProductCard({ product }: { product: HeroProductCardData }) {
  return (
    <div className="pointer-events-auto flex w-full flex-col gap-1.5 bg-surface border border-line p-3.5 sm:p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 monospace text-[8px]">
        <span className="text-brand font-bold">OUTFIT // NEURAL SERIES</span>
        <span className="text-ink-secondary">
          {`${product.categoryCode} // ${product.category}`}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base sm:text-lg font-black italic tracking-tight text-ink-primary leading-none">
          {product.title}
        </span>
        <span className="monospace text-xs sm:text-sm font-black text-brand">
          {product.price}
        </span>
      </div>

      <p className="monospace text-[9px] text-ink-secondary leading-snug">{product.subtitle}</p>

      <div className="mt-1 flex items-center justify-between gap-3 border-t border-line pt-2">
        <Link
          href={`/product/${product.slug}`}
          className="monospace text-[9px] font-bold text-ink-primary hover:text-brand transition-colors whitespace-nowrap"
        >
          EXPLORE PRODUCT <span aria-hidden="true">→</span>
        </Link>
        <span className="monospace text-[8px] text-ink-muted whitespace-nowrap">
          ⌖ DRAG TO ROTATE
        </span>
      </div>
    </div>
  );
}

/** Skeleton shown while the live product data streams in. */
export function HeroProductCardSkeleton() {
  return (
    <div
      className="pointer-events-auto w-full animate-pulse border border-line bg-surface p-3.5 sm:p-4 backdrop-blur-md flex flex-col gap-2"
      aria-hidden="true"
    >
      <div className="h-2 w-3/5 bg-surface-elevated" />
      <div className="h-4 w-1/2 bg-surface-elevated" />
      <div className="h-2 w-4/5 bg-surface-elevated" />
      <div className="mt-1 h-3 w-2/5 bg-surface-elevated" />
    </div>
  );
}
