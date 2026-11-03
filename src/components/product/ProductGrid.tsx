'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { WishlistButton } from '@/components/product/WishlistButton';
import type { ProductCardData } from '@/lib/products';

// Re-exported for backwards compatibility — the canonical type lives in the
// data-access layer (src/lib/products.ts) since it is shared with the server.
export type { ProductCardData };

interface ProductGridProps {
  products: ProductCardData[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const addItem = useCartStore((s) => s.addItem);
  const toggleCart = useCartStore((s) => s.toggleCart);

  function quickAdd(item: ProductCardData) {
    // QUICK_ADD uses the product's default (first) size. Other variants are
    // selectable on the PDP — each size is a distinct cart line.
    const defaultSize = item.sizes[0];
    if (!defaultSize || !item.inStock) return;
    addItem({
      productId: item.id,
      slug: item.slug,
      size: defaultSize,
      name: item.title,
      price: item.priceRaw,
      image: item.images[0],
      quantity: 1,
    });
    toggleCart();
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.07, duration: 0.5, ease: 'easeOut' }}
          whileHover={{ y: -8 }}
          className="bg-surface border border-line p-1 flex flex-col gap-0 group cursor-pointer relative rounded-[4px]"
        >
          {/* New badge */}
          {item.isNew && (
            <span className="absolute top-3 left-3 z-10 bg-brand text-ink-primary font-mono text-[8px] px-2 py-0.5 font-bold">
              NEW
            </span>
          )}

          {/* Product image / colour swatch */}
          <Link
            href={`/product/${item.slug}`}
            id={`product-card-${item.id}`}
            className="block aspect-[4/5] relative overflow-hidden rounded-[4px]"
          >
            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden bg-surface"
            >
              {item.images[0]?.startsWith('/') || item.images[0]?.startsWith('http') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.images[0]}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: item.images[0] ?? '#D1D5D8' }}
                >
                  <span className="font-mono text-[10px] text-ink-muted group-hover:text-ink-secondary transition-colors">
                    {item.title}
                  </span>
                </div>
              )}

              {/* HUD corners on hover */}
              <div className="absolute inset-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-brand" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t border-r border-brand" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-brand" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-brand" />
              </div>

              {/* Category label */}
              <div className="absolute top-3 right-3 font-mono text-[8px] text-ink-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                {item.categoryCode}
              </div>
            </div>
          </Link>

          {/* Card info */}
          <div className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[9px] text-ink-muted italic">INDX.{item.id.slice(-2).toUpperCase()}</span>
              <span className="font-mono text-[10px] font-bold text-brand">{item.price}</span>
            </div>
            <h3 className="text-base font-display font-bold italic tracking-tight text-ink-primary">{item.title}</h3>
            <p className="text-[11px] text-ink-secondary leading-snug">{item.subtitle}</p>

            {/* Quick-add row */}
            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
              <WishlistButton product={item} className="border border-line rounded-[4px] hover:border-brand" />
              <button
                id={`quick-add-${item.id}`}
                onClick={() => quickAdd(item)}
                disabled={!item.inStock}
                className="flex-1 bg-brand text-ink-primary font-mono text-[9px] font-bold py-2 rounded-[4px] hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {item.inStock ? 'QUICK_ADD +' : 'SOLD_OUT'}
              </button>
              <Link
                href={`/product/${item.slug}`}
                className="border border-line font-mono text-[9px] px-3 flex items-center hover:border-brand transition-colors"
              >
                →
              </Link>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
