import type { Metadata } from 'next';
import { WishlistContent } from '@/components/product/WishlistContent';

export const metadata: Metadata = {
  title: 'Wishlist | VEXO',
  robots: {
    index: false,
    follow: false,
  },
};

export default function WishlistPage() {
  return <WishlistContent />;
}
