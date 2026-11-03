import { db } from '@/lib/db';

// ─────────────────────────────────────────────────
// Product data-access layer
// All catalogue reads go through this module. Server Components and API
// routes must never query `db` directly or import static product data.
// ─────────────────────────────────────────────────

/** Per-size variant — availability is tracked per size, not per product. */
export interface ProductVariantData {
  size: string;
  stock: number;
}

/** Full product shape handed to client components (PDP). */
export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  price: string; // formatted, e.g. "$840.00"
  priceRaw: number;
  category: string;
  categoryCode: string;
  description: string;
  details: string[];
  sizes: string[]; // derived from variants, in schema order
  variants: ProductVariantData[];
  images: string[]; // image URLs or colour swatches
  version: string;
  isNew?: boolean;
  inStock: boolean;
}

/** Minimal shape for product cards on listing pages. */
export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  price: string; // formatted, e.g. "$840.00"
  priceRaw: number;
  sizes: string[]; // default (first) size used by QUICK_ADD
  images: string[]; // colour hex or URLs
  category: string;
  categoryCode: string;
  isNew?: boolean;
  inStock: boolean;
}

export interface ProductPage {
  products: ProductCardData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

// ── Serialisation ────────────────────────────────────────────────────────

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatPrice(value: number): string {
  return currency.format(value);
}

function toCardData(p: {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  price: unknown;
  category: string;
  categoryCode: string;
  isNew: boolean;
  inStock: boolean;
  images: unknown;
  variants: { size: string }[];
}): ProductCardData {
  const priceRaw = Number(p.price);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    price: formatPrice(priceRaw),
    priceRaw,
    sizes: p.variants.map((v) => v.size),
    images: (p.images as string[]) ?? [],
    category: p.category,
    categoryCode: p.categoryCode,
    isNew: p.isNew,
    inStock: p.inStock,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Paginated catalogue listing.
 * Supports optional (case-insensitive) category filter and text search.
 */
export async function getProducts({
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  category,
  q,
  sort = 'featured',
  inStock,
}: {
  page?: number;
  pageSize?: number;
  category?: string;
  q?: string;
  sort?: 'featured' | 'newest' | 'price-asc' | 'price-desc';
  inStock?: boolean;
} = {}): Promise<ProductPage> {
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize)));

  const where = {
    ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
    ...(inStock ? { inStock: true } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { subtitle: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === 'price-asc'
      ? { price: 'asc' as const }
      : sort === 'price-desc'
        ? { price: 'desc' as const }
        : { createdAt: 'desc' as const };

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      include: { variants: { select: { size: true }, orderBy: { createdAt: 'asc' } } },
    }),
    db.product.count({ where }),
  ]);

  return {
    products: items.map(toCardData),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

/** Homepage showcase — newest products, hard-capped. */
export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(limit)));
  const items = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: { variants: { select: { size: true }, orderBy: { createdAt: 'asc' } } },
  });
  return items.map(toCardData);
}

/** Slug-based product retrieval with per-size variants (includes out-of-stock sizes). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const p = await db.product.findUnique({
    where: { slug },
    include: { variants: { orderBy: { createdAt: 'asc' } } },
  });
  if (!p) return null;

  const priceRaw = Number(p.price);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    price: formatPrice(priceRaw),
    priceRaw,
    category: p.category,
    categoryCode: p.categoryCode,
    description: p.description,
    details: p.details,
    sizes: p.variants.map((v) => v.size),
    variants: p.variants.map((v) => ({ size: v.size, stock: v.stock })),
    images: (p.images as string[]) ?? [],
    version: p.version,
    isNew: p.isNew,
    inStock: p.inStock,
  };
}

/** All slugs — for generateStaticParams. */
export async function getAllProductSlugs(): Promise<string[]> {
  const items = await db.product.findMany({ select: { slug: true }, orderBy: { createdAt: 'desc' } });
  return items.map((p) => p.slug);
}

/** Distinct categories present in the catalogue (for filter chips). */
export async function getCategories(): Promise<string[]> {
  const rows = await db.product.findMany({
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}
