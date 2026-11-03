'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Product } from '@/lib/products';
import { ImageGallery } from '@/components/product/ImageGallery';
import { RiveButton } from '@/components/ui/RiveButton';
import { WishlistButton } from '@/components/product/WishlistButton';
import { useCartStore } from '@/store/cartStore';

interface PDPClientProps {
  product: Product;
}

export function PDPClient({ product }: PDPClientProps) {
  const initialVariant = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [selectedSize, setSelectedSize] = useState<string>(initialVariant?.size ?? '');
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const toggleCart = useCartStore((s) => s.toggleCart);

  const selectedVariant = product.variants.find((v) => v.size === selectedSize);
  const stock = selectedVariant?.stock ?? 0;
  const isOutOfStock = !product.inStock || stock <= 0;
  const maxQty = Math.max(1, stock);

  function handleAddToCart() {
    if (isOutOfStock || !selectedSize) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      size: selectedSize,
      name: product.title,
      price: product.priceRaw,
      image: product.images[0],
      quantity: qty,
      stock,
    });
    setAddedFeedback(true);
    toggleCart();
    setTimeout(() => setAddedFeedback(false), 2000);
  }

  return (
    <div className="min-h-screen pt-20">
      {/* Breadcrumb */}
      <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center gap-3 font-mono text-[10px] text-ink-secondary border-b border-line">
        <Link href="/" className="hover:text-brand transition-colors">HOME</Link>
        <span>/</span>
        <Link
          href={`/collections/${encodeURIComponent(product.category)}`}
          className="text-brand transition-colors hover:text-ink-primary"
        >
          {product.categoryCode}
        </Link>
        <span>/</span>
        <span className="text-ink-primary">{product.title}</span>
        {product.isNew && (
          <span className="ml-auto bg-brand text-ink-primary px-2 py-0.5 text-[8px] font-bold">
            NEW_ARRIVAL
          </span>
        )}
      </div>

      {/* Product photography remains tied to the selected catalogue product. */}
      <div className="max-w-[1800px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-0 min-h-[85vh]">
        {/* ── Left: Product-specific gallery ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="min-w-0 lg:col-span-7 border-r border-line p-6"
        >
          <ImageGallery
            key={product.slug}
            images={product.images}
            productTitle={product.title}
            productSlug={product.slug}
          />
        </motion.div>

        {/* ── Right: Product Info Panel (5 cols, ~35%) ───────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="min-w-0 lg:col-span-5 lg:sticky lg:top-20 lg:self-start p-8 flex flex-col gap-8"
        >
          {/* Category tag */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] font-bold text-brand">
              {product.categoryCode}
            </span>
            <div className="flex-1 h-[1px] bg-line" />
            <span className="font-mono text-[9px] text-ink-secondary">{product.version}</span>
          </div>

          {/* Title block */}
          <div className="flex flex-col gap-2">
            <h1 className="break-words text-5xl font-black italic tracking-tighter leading-[0.9] text-ink-primary">
              {product.title}
            </h1>
            <p className="font-mono text-[10px] text-ink-secondary">{product.subtitle}</p>
          </div>

          {/* Price */}
          <div className="flex items-end gap-4 pb-6 border-b border-line">
            <span className="text-4xl font-black italic text-brand">{product.price}</span>
            <span className="font-mono text-[9px] text-ink-muted mb-1">EXCL. TAX</span>
          </div>

          {/* Description */}
          <p className="text-sm text-ink-secondary leading-relaxed">{product.description}</p>

          {/* Size selector */}
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] font-bold text-ink-primary">SELECT_SIZE</span>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => {
                const outOfStock = variant.stock <= 0 || !product.inStock;
                return (
                  <button
                    key={variant.size}
                    id={`size-${variant.size}`}
                    onClick={() => {
                      setSelectedSize(variant.size);
                      setQty(1);
                    }}
                    disabled={outOfStock}
                    title={outOfStock ? 'Out of stock' : `${variant.stock} in stock`}
                    className={`px-4 py-2 font-mono text-[10px] font-bold border transition-all duration-150
                      ${outOfStock
                        ? 'border-line text-ink-muted/40 line-through cursor-not-allowed'
                        : selectedSize === variant.size
                          ? 'bg-brand text-ink-primary border-brand'
                          : 'border-line text-ink-secondary hover:border-brand hover:text-brand'
                      }`}
                  >
                    {variant.size}
                  </button>
                );
              })}
            </div>
            {isOutOfStock ? (
              <span className="font-mono text-[9px] text-destructive font-bold">SOLD_OUT</span>
            ) : (
              <span className="font-mono text-[9px] text-ink-secondary">
                {stock <= 5 ? `LOW_STOCK: ${stock} LEFT` : `${stock} IN_STOCK`}
              </span>
            )}
          </div>

          {/* Quantity stepper */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] font-bold text-ink-primary">QTY</span>
            <div className="flex items-center border border-line">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1}
                className="px-4 py-2 font-mono text-sm text-ink-secondary hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="px-4 py-2 font-mono text-sm font-bold min-w-[2rem] text-center text-ink-primary">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={isOutOfStock || qty >= maxQty}
                className="px-4 py-2 font-mono text-sm text-ink-secondary hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            {!isOutOfStock && (
              <span className="font-mono text-[9px] text-ink-secondary">MAX {maxQty}</span>
            )}
          </div>

          {/* CTA row */}
          <div className="flex flex-col gap-3 pt-2">
            <RiveButton
              id="pdp-add-to-cart"
              label={isOutOfStock ? 'SOLD_OUT' : addedFeedback ? 'ADDED ✓' : 'ADD_TO_CART'}
              variant="primary"
              disabled={isOutOfStock}
              className={`w-full justify-center ${addedFeedback ? '!bg-brand' : ''}`}
              onClick={handleAddToCart}
            />
            <WishlistButton product={product} />
          </div>

          {/* Product details accordion */}
          <div className="border-t border-line pt-6">
            <p className="font-mono text-[10px] font-bold text-ink-primary mb-4">TECH_DETAILS</p>
            <ul className="flex flex-col gap-2">
              {product.details.map((detail) => (
                <li key={detail} className="flex items-start gap-3 text-sm text-ink-secondary">
                  <span className="text-brand mt-1 text-[10px]">▸</span>
                  {detail}
                </li>
              ))}
            </ul>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
