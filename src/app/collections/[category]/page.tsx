import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { CatalogueContent, CatalogueSkeleton } from '@/components/collections/CatalogueContent';
import { getCategories } from '@/lib/products';

export async function generateStaticParams() {
  // Without DATABASE_URL/DIRECT_URL, static route generation cannot access
  // the database. Return an empty set so the page renders at request time
  // instead of build time. When credentials are available, all category
  // routes are statically generated as before.
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    return [];
  }
  const categories = await getCategories();
  return categories.map((category) => ({ category }));
}

interface CollectionPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
    sort?: string;
    inStock?: string;
  }>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { category } = await params;
  const canonical = category.toUpperCase();
  return {
    title: `${canonical} | VEXO`,
    description: `The ${canonical} collection — VEXO fashion.`,
    alternates: {
      canonical: `/collections/${encodeURIComponent(category)}`,
    },
  };
}

async function CollectionView({
  category,
  searchParams,
}: {
  category: string;
  searchParams: Promise<{
    page?: string;
    q?: string;
    sort?: string;
    inStock?: string;
  }>;
}) {
  await connection();
  const categories = await getCategories();
  const valid = categories.some((c) => c.toUpperCase() === category.toUpperCase());
  if (!valid) notFound();
  return <CatalogueContent basePath="/collections" category={category} searchParams={searchParams} />;
}

// ── Collection landing page ────────────────────────────────────────────
// Data-driven: invalid collections 404. Reuses the shared catalogue body so
// every collection renders through one implementation. All uncached data
// access happens inside the <Suspense> boundary (cacheComponents rule).
export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { category } = await params;

  return (
    <div className="pt-24 pb-24 px-6 max-w-[1800px] mx-auto min-h-screen">
      <Suspense fallback={<CatalogueSkeleton />}>
        <CollectionView category={category} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
