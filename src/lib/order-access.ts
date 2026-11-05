import { createHash, timingSafeEqual } from 'node:crypto';

export function hashCheckoutToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function canAccessOrder(
  order: { userId: string | null; guestAccessTokenHash: string | null },
  userId: string | null,
  checkoutToken: string | null,
): boolean {
  if (order.userId !== null) {
    return userId !== null && userId === order.userId;
  }
  if (!checkoutToken || !order.guestAccessTokenHash) return false;

  const actualHash = Buffer.from(hashCheckoutToken(checkoutToken), 'hex');
  const expectedHash = Buffer.from(order.guestAccessTokenHash, 'hex');
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
}
