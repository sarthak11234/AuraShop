'use client';

import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductCardData } from '@/lib/products';
import { useWishlistStore } from '@/store/wishlistStore';

interface WishlistButtonProps {
  product: ProductCardData;
  className?: string;
}

export function WishlistButton({ product, className }: WishlistButtonProps) {
  const isWishlisted = useWishlistStore((state) =>
    state.items.some((item) => item.id === product.id),
  );
  const toggleItem = useWishlistStore((state) => state.toggleItem);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleItem(product);
      }}
      className={cn(
        'p-2 rounded-full text-ink-secondary hover:text-brand hover:bg-surface transition-colors',
        isWishlisted && 'text-brand',
        className
      )}
      aria-pressed={isWishlisted}
      aria-label={`${isWishlisted ? 'Remove' : 'Add'} ${product.title} ${isWishlisted ? 'from' : 'to'} wishlist`}
    >
      <Heart size={16} className={isWishlisted ? 'fill-brand' : ''} />
    </button>
  );
}
