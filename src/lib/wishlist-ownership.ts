export type WishlistOwnershipAction = 'keep' | 'claim' | 'clear' | 'reset-to-user';

/**
 * Keeps the browser-persisted wishlist scoped to the signed-in customer.
 *
 * - Guest -> authenticated: claim the existing guest items for that customer.
 * - Same authenticated customer: keep the saved items.
 * - Different authenticated customer: discard the previous customer's items.
 * - Sign-out: clear anything owned by the previous account.
 */
export function wishlistOwnershipAction(
  ownerId: string | null,
  userId: string | null,
): WishlistOwnershipAction {
  if (!userId) return ownerId ? 'clear' : 'keep';
  if (!ownerId) return 'claim';
  return ownerId === userId ? 'keep' : 'reset-to-user';
}
