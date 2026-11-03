import React from 'react';
import Link from 'next/link';
import { ProductGrid } from '@/components/product/ProductGrid';
import { getCategories, getProducts } from '@/lib/products';

export const CATALOGUE_SORTS = ['featured', 'newest', 'price-asc', 'price-desc'] as const;
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

const SORT_LABELS: Record<CatalogueSort, string> = {
  featured: 'FEATURED',
  newest: 'NEWEST',
  'price-asc': 'PRICE ↑',
  'price-desc': 'PRICE ↓',
};

interface CatalogueSearchParams {
  page?: string;
  category?: string;
  q?: string;
  sort?: string;
  inStock?: string;
}

interface CatalogueProps {
  basePath?: string;
  category?: string;
  searchParams: Promise<CatalogueSearchParams>;
}

function buildHref(
  basePath: string,
  opts: { page?: number; category?: string; inStock?: boolean; q?: string; sort?: string }
): string {
  const sp = new URLSearchParams();
  if (opts.page && opts.page > 1) sp.set('page', String(opts.page));
  if (opts.category) sp.set('category', opts.category);
  if (opts.inStock) sp.set('inStock', 'true');
  if (opts.q) sp.set('q', opts.q);
  if (opts.sort && opts.sort !== 'featured') sp.set('sort', opts.sort);
  const qs = sp.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}

async function Catalogue({ basePath = '/collections', category, searchParams }: CatalogueProps) {
  const { page: pageParam, category: queryCategory, q, sort: sortParam, inStock: inStockParam } = await searchParams;
  const selectedCategory = category ?? queryCategory;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const sort: CatalogueSort =
    (CATALOGUE_SORTS as readonly string[]).includes(sortParam ?? '') && sortParam
      ? (sortParam as CatalogueSort)
      : 'featured';
  const inStock = inStockParam === 'true';

  const [result, categories] = await Promise.all([
    getProducts({
      page,
      pageSize: 12,
      category: selectedCategory,
      q: q?.trim() || undefined,
      sort,
      inStock,
    }),
    getCategories(),
  ]);

  const heading = selectedCategory ? selectedCategory.toUpperCase() : 'FULL CATALOGUE';
  const resultLabel = selectedCategory || inStock || q ? 'RESULTS' : 'PRODUCTS';

  return (
    <>
      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-12 font-mono text-[10px]">
        <span className="text-ink-muted mr-2">FILTER.CATEGORY:</span>
        <Link
          href={buildHref(basePath, { category: undefined, inStock: false, q: undefined, sort: 'featured', page })}
          className={`px-3 py-1.5 border font-bold transition-colors ${
            !selectedCategory && !inStock
              ? 'bg-brand text-ink-primary border-brand'
              : 'border-line text-ink-secondary hover:border-brand hover:text-brand'
          }`}
        >
          ALL
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={buildHref(basePath, { category: c, inStock: false, q: undefined, sort: 'featured', page })}
            className={`px-3 py-1.5 border font-bold transition-colors ${
              selectedCategory?.toUpperCase() === c.toUpperCase()
                ? 'bg-brand text-ink-primary border-brand'
                : 'border-line text-ink-secondary hover:border-brand hover:text-brand'
            }`}
          >
            {c}
          </Link>
        ))}
        <Link
          href={
            inStock
              ? buildHref(basePath, { category: selectedCategory, inStock: false, q, sort, page })
              : buildHref(basePath, { category: selectedCategory, inStock: true, q, sort, page })
          }
          className={`px-3 py-1.5 border font-bold transition-colors ${
            inStock ? 'bg-brand text-ink-primary border-brand' : 'border-line text-ink-secondary hover:border-brand hover:text-brand'
          }`}
        >
          IN_STOCK
        </Link>
      </div>

      {/* Result count HUD */}
      <div className="flex justify-between items-end mb-8">
        <h1 className="text-3xl font-black italic tracking-tighter text-ink-primary">{heading}</h1>
        <span className="font-mono font-bold text-ink-secondary text-[11px]">
          [{String(result.total).padStart(2, '0')} {resultLabel}]
        </span>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-8 font-mono text-[10px]">
        <span className="text-ink-muted mr-2">SORT:</span>
        {CATALOGUE_SORTS.map((s) => (
          <Link
            key={s}
            href={buildHref(basePath, { category: selectedCategory, inStock, q, sort: s === 'featured' ? undefined : s, page })}
            className={`px-3 py-1.5 border font-bold transition-colors ${
              sort === s ? 'bg-brand text-ink-primary border-brand' : 'border-line text-ink-secondary hover:border-brand hover:text-brand'
            }`}
          >
            {SORT_LABELS[s]}
          </Link>
        ))}
      </div>

      {result.products.length === 0 ? (
        <div className="border border-line py-24 flex flex-col items-center gap-3">
          <span className="font-mono text-brand font-bold text-[11px]">NO_PRODUCTS_FOUND</span>
          <p className="text-sm text-ink-secondary">
            {selectedCategory ? `Nothing in ${selectedCategory.toUpperCase()} right now.` : q ? `No results for "${q}".` : 'The catalogue is empty.'}
          </p>
          <Link href={basePath} className="font-mono text-[10px] text-brand hover:underline mt-2">
            ← VIEW ALL PRODUCTS
          </Link>
        </div>
      ) : (
        <>
          <ProductGrid products={result.products} />
          <Pagination page={result.page} totalPages={result.totalPages} basePath={basePath} category={selectedCategory} inStock={inStock} q={q} sort={sort} />
        </>
      )}
    </>
  );
}

function Pagination({
  page,
  totalPages,
  basePath,
  category,
  inStock,
  q,
  sort,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  category?: string;
  inStock: boolean;
  q?: string;
  sort: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => buildHref(basePath, { page: p, category, inStock, q, sort });

  return (
    <nav className="flex items-center justify-center gap-4 pt-12 font-mono text-[10px]" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className="border border-line px-4 py-2 font-bold text-ink-secondary hover:border-brand hover:text-brand transition-colors">
          ← PREV
        </Link>
      ) : (
        <span className="border border-line px-4 py-2 text-ink-muted/40">← PREV</span>
      )}

      <span className="text-ink-secondary">
        PAGE <span className="text-brand font-bold">{String(page).padStart(2, '0')}</span> / {String(totalPages).padStart(2, '0')}
      </span>

      {page < totalPages ? (
        <Link href={href(page + 1)} className="border border-line px-4 py-2 font-bold text-ink-secondary hover:border-brand hover:text-brand transition-colors">
          NEXT →
        </Link>
      ) : (
        <span className="border border-line px-4 py-2 text-ink-muted/40">NEXT →</span>
      )}
    </nav>
  );
}

export async function CatalogueContent({ basePath = '/collections', category, searchParams }: CatalogueProps) {
  const content = await Catalogue({ basePath, category, searchParams });
  return <>{content}</>;
}

export async function CatalogueSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-8 bg-surface animate-pulse w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-surface animate-pulse aspect-[4/5] rounded-[4px]" />
        ))}
      </div>
    </div>
  );
}
