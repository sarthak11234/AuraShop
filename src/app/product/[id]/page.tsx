import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAllProductSlugs, getProductBySlug } from '@/lib/products';
import { PDPClient } from './PDPClient';

// ── Static params for build-time generation ───────────────────────────
export async function generateStaticParams() {
  // Without DATABASE_URL/DIRECT_URL, static route generation cannot access
  // the database. Return an empty set so the page renders at request time
  // instead of build time. When credentials are available, all product
  // routes are statically generated as before.
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    return [];
  }
  const slugs = await getAllProductSlugs();
  return slugs.map((slug) => ({ id: slug }));
}

// ── SEO metadata ──────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductBySlug(id);
  if (!product) return { title: 'Not Found | VEXO' };
  return {
    title: `${product.title} — ${product.subtitle} | VEXO`,
    description: product.description,
    alternates: {
      canonical: `/product/${product.slug}`,
    },
    openGraph: {
      title: product.title,
      description: product.subtitle,
      url: `/product/${product.slug}`,
      images: product.images[0]?.startsWith('/') ? [product.images[0]] : undefined,
    },
  };
}

// ── Streaming boundary: static shell + skeleton, product data async ──
function PDPSkeleton() {
  return (
    <div className="min-h-screen pt-20 max-w-[1800px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12">
      <div className="lg:col-span-7 border-r border-line p-6">
        <div className="bg-surface animate-pulse w-full" style={{ minHeight: '60vh' }} />
      </div>
      <div className="lg:col-span-5 p-8 flex flex-col gap-6">
        <div className="h-4 bg-surface animate-pulse w-1/3" />
        <div className="h-12 bg-surface animate-pulse w-2/3" />
        <div className="h-8 bg-surface animate-pulse w-1/4" />
        <div className="h-32 bg-surface animate-pulse" />
      </div>
    </div>
  );
}

async function ProductContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Slug-based retrieval — 404s for unknown products (see notFound below).
  const product = await getProductBySlug(id);
  if (!product) notFound();

  return <PDPClient key={product.id} product={product} />;
}

// ── Page (Server Component) ───────────────────────────────────────────
// Unknown slugs are 404-gated in src/proxy.ts BEFORE this route renders
// (a mid-stream notFound() cannot change the HTTP status — see streaming.md).
export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PDPSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
