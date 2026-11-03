import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProductCardData } from '@/lib/products';

interface WishlistState {
  items: ProductCardData[];
  toggleItem: (product: ProductCardData) => void;
  removeItem: (productId: string) => void;
  clearWishlist: () => void;
}

const wishlistStorage = createJSONStorage(() =>
  typeof window === 'undefined'
    ? {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      }
    : window.localStorage,
);

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      items: [],
      toggleItem: (product) =>
        set((state) => ({
          items: state.items.some((item) => item.id === product.id)
            ? state.items.filter((item) => item.id !== product.id)
            : [...state.items, product],
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== productId) })),
      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: 'vexo-wishlist',
      storage: wishlistStorage,
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
    },
  ),
);
