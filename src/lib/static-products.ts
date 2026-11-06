// Static fallback catalogue data extracted from canonical seed-data.
// Strictly used when database connection is not available or during static export.
import { SEED_PRODUCTS, type SeedProduct } from '../../prisma/seed-data';

export interface ProductVariantData {
  size: string;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  price: string;
  priceRaw: number;
  category: string;
  categoryCode: string;
  description: string;
  details: string[];
  sizes: string[];
  variants: ProductVariantData[];
  images: string[];
  version: string;
  isNew?: boolean;
  inStock: boolean;
}

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  price: string;
  priceRaw: number;
  sizes: string[];
  variants: ProductVariantData[];
  images: string[];
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

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatPrice(value: number): string {
  return currency.format(value);
}

export function toStaticProduct(p: SeedProduct): Product {
  const priceRaw = p.priceRaw;
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
    images: p.images ?? [],
    version: p.version,
    isNew: p.isNew ?? false,
    inStock: p.inStock ?? (p.variants.some((v) => v.stock > 0)),
  };
}

export function toStaticCardData(p: SeedProduct): ProductCardData {
  const priceRaw = p.priceRaw;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    price: formatPrice(priceRaw),
    priceRaw,
    sizes: p.variants.map((v) => v.size),
    variants: p.variants.map((v) => ({ size: v.size, stock: v.stock })),
    images: p.images ?? [],
    category: p.category,
    categoryCode: p.categoryCode,
    isNew: p.isNew ?? false,
    inStock: p.inStock ?? (p.variants.some((v) => v.stock > 0)),
  };
}

export function getStaticAllProducts(): ProductCardData[] {
  return SEED_PRODUCTS.map(toStaticCardData);
}

export function getStaticProductBySlug(slug: string): Product | null {
  const found = SEED_PRODUCTS.find((p) => p.slug === slug);
  if (!found) return null;
  return toStaticProduct(found);
}

export function getStaticFeaturedProducts(limit = 8): ProductCardData[] {
  return SEED_PRODUCTS.slice(0, limit).map(toStaticCardData);
}

export function getStaticAllProductSlugs(): string[] {
  return SEED_PRODUCTS.map((p) => p.slug);
}

export function getStaticCategories(): string[] {
  const categories = Array.from(new Set(SEED_PRODUCTS.map((p) => p.category)));
  return categories.sort();
}

export function getStaticProducts({
  page = 1,
  pageSize = 12,
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
} = {}): ProductPage {
  let filtered = SEED_PRODUCTS.map(toStaticCardData);

  if (category) {
    filtered = filtered.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (inStock) {
    filtered = filtered.filter((p) => p.inStock);
  }

  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.subtitle.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }

  if (sort === 'price-asc') {
    filtered.sort((a, b) => a.priceRaw - b.priceRaw);
  } else if (sort === 'price-desc') {
    filtered.sort((a, b) => b.priceRaw - a.priceRaw);
  }

  const total = filtered.length;
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.max(1, Math.trunc(pageSize));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  const start = (safePage - 1) * safePageSize;
  const paginated = filtered.slice(start, start + safePageSize);

  return {
    products: paginated,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}
