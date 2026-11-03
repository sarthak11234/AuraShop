import { create } from 'zustand';

// ─────────────────────────────────────────────────
// Cart model
// A line is identified by `productId:size` — the same product in two sizes
// is two lines; the same product+size merges into one line with a summed
// quantity. Quantities are always integers >= 1.
// ─────────────────────────────────────────────────

export interface CartItem {
  key: string; // `${productId}:${size}` — stable line identity
  productId: string;
  slug: string;
  size: string;
  name: string;
  price: number; // unit price (USD, dollars)
  image?: string; // colour swatch or image URL for the thumbnail
  quantity: number; // always >= 1
}

export interface AddToCartInput {
  productId: string;
  slug: string;
  size: string;
  name: string;
  price: number;
  image?: string;
  quantity?: number;
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

/** Sanitise an incoming quantity: integers only, never below 1. */
function safeQuantity(q: number): number {
  if (!Number.isFinite(q)) return 1;
  return Math.max(1, Math.trunc(q));
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  isCartOpen: false,

  addItem: (input) =>
    set((state) => {
      const quantity = safeQuantity(input.quantity ?? 1);
      const key = lineKey(input.productId, input.size);

      const existing = state.items.find((i) => i.key === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.key === key ? { ...i, quantity: safeQuantity(i.quantity + quantity) } : i
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
          i.key === key ? { ...i, quantity: safeQuantity(next) } : i
        ),
      };
    }),

  removeItem: (key) =>
    set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

  clearCart: () => set({ items: [] }),
  setCartOpen: (open) => set({ isCartOpen: open }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
}));

/** Exact cart total in integer cents (avoids floating-point drift). */
export function cartTotalCents(items: CartItem[]): number {
  return items.reduce(
    (acc, item) => acc + Math.round(item.price * 100) * item.quantity,
    0
  );
}
