import type { Metadata } from 'next';
import { TheEditPage } from '@/components/editorial/TheEditPage';

const description =
  'A new perspective on form, function and expression. Enter The VEXO Edit: a fashion campaign in four expressions.';

export const metadata: Metadata = {
  title: 'The VEXO Edit — The Future Has Form',
  description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'The VEXO Edit — The Future Has Form',
    description,
    url: '/',
    images: ['/images/products/campaign-hero.webp'],
  },
};

export default function HomePage() {
  return <TheEditPage />;
}
