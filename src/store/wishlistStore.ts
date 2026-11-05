import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProductCardData } from '@/lib/products';

interface WishlistState {
  items: ProductCardData[];
  /** Auth.js user id that owns the persisted wishlist, or null for a guest. */
  ownerId: string | null;
  toggleItem: (product: ProductCardData) => void;
  removeItem: (productId: string) => void;
  clearWishlist: () => void;
  setOwnerId: (ownerId: string | null) => void;
  replaceItems: (items: ProductCardData[]) => void;
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
      ownerId: null,
      toggleItem: (product) =>
        set((state) => ({
          items: state.items.some((item) => item.id === product.id)
            ? state.items.filter((item) => item.id !== product.id)
            : [...state.items, product],
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== productId) })),
      clearWishlist: () => set({ items: [], ownerId: null }),
      setOwnerId: (ownerId) => set({ ownerId }),
      replaceItems: (items) => set({ items }),
    }),
    {
      name: 'vexo-wishlist',
      storage: wishlistStorage,
      partialize: (state) => ({ items: state.items, ownerId: state.ownerId }),
      skipHydration: true,
    },
  ),
);
