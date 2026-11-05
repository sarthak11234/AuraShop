'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useWishlistStore } from '@/store/wishlistStore';
import { wishlistOwnershipAction } from '@/lib/wishlist-ownership';

/**
 * Reconciles the persisted wishlist with the authenticated customer. This
 * prevents a shared browser from showing one customer's saved pieces to
 * another while preserving the existing local wishlist behaviour for guests.
 */
export function WishlistAccountSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (status === 'loading') return;

    const apply = () => {
      const state = useWishlistStore.getState();
      const action = wishlistOwnershipAction(state.ownerId, userId);
      if (action === 'claim' && userId) {
        state.setOwnerId(userId);
      } else if (action === 'clear') {
        state.clearWishlist();
      } else if (action === 'reset-to-user' && userId) {
        state.clearWishlist();
        state.setOwnerId(userId);
      }
    };

    if (useWishlistStore.persist.hasHydrated()) {
      apply();
      return;
    }
    return useWishlistStore.persist.onFinishHydration(apply);
  }, [status, userId]);

  return null;
}
