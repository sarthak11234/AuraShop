'use client';

import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  CartEmptyState,
  CartItemRow,
  CartOrderSummary,
  CheckoutLink,
} from '@/components/cart/CartContents';
import { useOverlayBehavior } from '@/hooks/useOverlayBehavior';
import { useCartStore } from '@/store/cartStore';

export function CartSidebar() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const isCartOpen = useCartStore((state) => state.isCartOpen);
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const { closeRef, dialogRef } = useOverlayBehavior(isCartOpen, () => setCartOpen(false));

  const continueShopping = () => {
    setCartOpen(false);
    router.push('/collections');
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <motion.div
          key="cart-overlay"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            aria-describedby="cart-description"
            tabIndex={-1}
            initial={reduceMotion ? { x: 0 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { x: 0 } : { x: '100%' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 240 }}
            className="absolute inset-y-0 right-0 z-10 flex h-[100dvh] w-full max-w-lg flex-col border-l border-line bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pb-6"
          >
            <div className="flex items-center justify-between border-b border-line pb-5">
              <div>
                <h2 id="cart-title" className="font-display text-xl font-bold tracking-tight text-ink-primary">
                  CART
                </h2>
                <p id="cart-description" className="mt-1 font-mono text-[10px] text-ink-secondary">
                  {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
                </p>
              </div>
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
                className="h-11 w-11"
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </div>

            {items.length === 0 ? (
              <CartEmptyState onContinueShopping={continueShopping} />
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-5">
                  {items.map((item) => <CartItemRow key={item.key} item={item} />)}
                </div>
                <div className="space-y-4 border-t border-line pt-4">
                  <CartOrderSummary items={items} id="cart-drawer-order-summary" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={continueShopping}
                    className="min-h-11 w-full font-mono text-[10px] uppercase tracking-widest"
                  >
                    Continue shopping
                  </Button>
                  <Link
                    href="/cart"
                    onClick={() => setCartOpen(false)}
                    className="flex min-h-11 items-center justify-center font-mono text-[10px] uppercase tracking-widest text-ink-secondary transition-colors hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    View full cart
                  </Link>
                  <CheckoutLink onClick={() => setCartOpen(false)} />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearCart}
                    className="min-h-10 w-full font-mono text-[10px] uppercase tracking-widest text-ink-muted"
                  >
                    Clear cart
                  </Button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
