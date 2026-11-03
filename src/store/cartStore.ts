import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────
// Cart model
// A line is identified by `productId:size` — the same product in two sizes
// is two lines; the same product+size merges into one line with a summed
// quantity. Quantities are always integers >= 1 and never exceed the
// variant stock captured when the item was added.
// ─────────────────────────────────────────────────

export interface CartItem {
  key: string; // `${productId}:${size}` — stable line identity
  productId: string;
  slug: string;
  size: string;
  name: string;
  price: number; // unit price (USD, dollars)
  image?: string; // colour swatch or image URL for the thumbnail
  quantity: number; // always >= 1 and <= stock (when stock is known)
  stock?: number; // per-variant availability, used to cap the quantity
}

export interface AddToCartInput {
  productId: string;
  slug: string;
  size: string;
  name: string;
  price: number;
  image?: string;
  quantity?: number;
  stock?: number;
}

interface CartState {
  items: CartItem[];
  isCartOpen: boolean;
  addItem: (item: AddToCartInput) => void;
  updateQuantity: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  setCartOpen: (open: boolean) => void;
  toggleCart: () => void;
}

function lineKey(productId: string, size: string): string {
  return `${productId}:${size}`;
}

/** Largest quantity a line may hold. Unknown stock is treated as unbounded. */
function quantityLimit(stock?: number): number {
  return stock !== undefined && Number.isFinite(stock)
    ? Math.max(1, Math.trunc(stock))
    : Number.POSITIVE_INFINITY;
}

/** Sanitise an incoming quantity: integers only, never below 1. */
function safeQuantity(q: number, stock?: number): number {
  if (!Number.isFinite(q)) return 1;
  return Math.min(quantityLimit(stock), Math.max(1, Math.trunc(q)));
}

const cartStorage = createJSONStorage(() =>
  typeof window === 'undefined'
    ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
    : window.localStorage,
);

/** Drop malformed persisted lines and re-apply stock caps after rehydration. */
function sanitisePersistedItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CartItem[] => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.key !== 'string' ||
      typeof item.productId !== 'string' ||
      typeof item.slug !== 'string' ||
      typeof item.size !== 'string' ||
      typeof item.name !== 'string' ||
      !Number.isFinite(item.price)
    ) {
      return [];
    }
    const stock = Number.isFinite(item.stock) ? Math.trunc(item.stock) : undefined;
    return [{
      key: item.key,
      productId: item.productId,
      slug: item.slug,
      size: item.size,
      name: item.name,
      price: item.price,
      image: typeof item.image === 'string' ? item.image : undefined,
      quantity: safeQuantity(Number(item.quantity), stock),
      stock,
    }];
  });
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isCartOpen: false,

      addItem: (input) =>
        set((state) => {
          const stock = input.stock;
          // A sold-out variant must never enter the cart, even if a caller
          // forgets to disable its button.
          if (stock !== undefined && stock <= 0) return state;

          const quantity = safeQuantity(input.quantity ?? 1, stock);
          const key = lineKey(input.productId, input.size);

          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key
                  ? {
                      ...i,
                      stock: stock ?? i.stock,
                      quantity: safeQuantity(i.quantity + quantity, stock ?? i.stock),
                    }
                  : i
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                key,
                productId: input.productId,
                slug: input.slug,
                size: input.size,
                name: input.name,
                price: input.price,
                image: input.image,
                quantity,
                stock,
              },
            ],
          };
        }),

      updateQuantity: (key, delta) =>
        set((state) => {
          const item = state.items.find((i) => i.key === key);
          if (!item) return state;

          const next = item.quantity + delta;
          // Never allow zero or negative quantities — drop the line instead.
          if (next < 1) {
            return { items: state.items.filter((i) => i.key !== key) };
          }
          return {
            items: state.items.map((i) =>
              i.key === key
                ? { ...i, quantity: safeQuantity(next, i.stock) }
                : i
            ),
          };
        }),

      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      clearCart: () => set({ items: [] }),
      setCartOpen: (open) => set({ isCartOpen: open }),
      toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
    }),
    {
      name: 'vexo-cart',
      storage: cartStorage,
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
      merge: (persisted, current) => {
        const state = persisted as { items?: unknown } | undefined;
        return { ...current, items: sanitisePersistedItems(state?.items) };
      },
    },
  ),
);

/** Exact cart total in integer cents (avoids floating-point drift). */
export function cartTotalCents(items: CartItem[]): number {
  return items.reduce(
    (acc, item) => acc + Math.round(item.price * 100) * item.quantity,
    0
  );
}
