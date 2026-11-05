'use client';

import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCartStore, cartTotalCents, type CartItem } from '@/store/cartStore';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCartPrice(cents: number): string {
  return currency.format(cents / 100);
}

export function CartItemRow({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const isImageUrl = item.image?.startsWith('/') || item.image?.startsWith('http');

  return (
    <article className="flex gap-4 border border-line bg-surface-elevated p-3 sm:p-4">
      <div
        className="relative h-20 w-20 shrink-0 overflow-hidden border border-line bg-surface"
        style={item.image && !isImageUrl ? { background: item.image } : undefined}
        aria-hidden="true"
      >
        {item.image && isImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        )}
        {!item.image && <ShoppingBag className="absolute inset-0 m-auto text-ink-muted" size={22} />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-sm font-bold text-ink-primary">{item.name}</h3>
            <p className="mt-1 font-mono text-[10px] text-ink-secondary">SIZE {item.size}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => removeItem(item.key)}
            aria-label={`Remove ${item.name}, size ${item.size}`}
            className="h-10 w-10 shrink-0 text-ink-muted hover:text-brand"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-ink-primary">
            {formatCartPrice(Math.round(item.price * 100))}
          </span>
          <div className="flex items-center border border-line" aria-label={`${item.name} quantity`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => updateQuantity(item.key, -1)}
              disabled={item.quantity <= 1}
              aria-label={`Decrease ${item.name} quantity`}
              className="h-10 w-10 rounded-none"
            >
              <Minus size={14} aria-hidden="true" />
            </Button>
            <span className="min-w-8 text-center font-mono text-xs text-ink-primary" aria-live="polite">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => updateQuantity(item.key, 1)}
              disabled={item.stock !== undefined && item.quantity >= item.stock}
              aria-label={`Increase ${item.name} quantity`}
              title={item.stock !== undefined && item.quantity >= item.stock ? `Maximum stock reached (${item.stock})` : undefined}
              className="h-10 w-10 rounded-none"
            >
              <Plus size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CartEmptyState({ onContinueShopping }: { onContinueShopping: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center border border-line bg-surface">
        <ShoppingBag size={26} strokeWidth={1} className="text-ink-secondary" aria-hidden="true" />
      </div>
      <div>
        <p className="font-mono text-[10px] font-bold tracking-widest text-brand">A CLEAR CANVAS</p>
        <h3 className="mt-2 font-display text-xl font-bold text-ink-primary">Your bag is empty</h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-secondary">
          Explore the VEXO collection and find your next piece.
        </p>
      </div>
      <Button type="button" onClick={onContinueShopping} className="min-h-11 px-6 font-mono text-[10px] uppercase tracking-widest">
        Continue shopping
      </Button>
    </div>
  );
}

export function CartOrderSummary({ items, id }: { items: CartItem[]; id: string }) {
  const subtotalCents = cartTotalCents(items);

  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-line pt-5">
      <h3 id={id} className="font-mono text-[10px] font-bold tracking-widest text-ink-secondary">
        ORDER SUMMARY
      </h3>
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-ink-secondary">Subtotal</span>
        <span className="font-bold text-ink-primary">{formatCartPrice(subtotalCents)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-line pt-4">
        <span className="font-mono text-xs text-ink-secondary">Total</span>
        <span className="font-display text-xl font-bold text-ink-primary">{formatCartPrice(subtotalCents)}</span>
      </div>
    </section>
  );
}

export function CheckoutLink({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/checkout"
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-center rounded-md bg-brand font-mono text-[10px] uppercase tracking-widest text-primary-foreground transition-colors hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      Proceed to checkout
    </Link>
  );
}
