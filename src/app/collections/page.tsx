import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CatalogueContent, CatalogueSkeleton } from '@/components/collections/CatalogueContent';

export const metadata: Metadata = {
  title: 'Collections | VEXO',
  description: 'Browse VEXO products by collection, availability and price.',
  alternates: {
    canonical: '/collections',
  },
};

export default function CollectionsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    category?: string;
    q?: string;
    sort?: string;
    inStock?: string;
  }>;
}) {
  return (
    <div className="min-h-screen px-6 pb-24 pt-24">
      <Suspense fallback={<CatalogueSkeleton />}>
        <CatalogueContent basePath="/collections" searchParams={process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true' ? undefined : searchParams} />
      </Suspense>
    </div>
  );
}
