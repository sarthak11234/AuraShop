// Static export version of products.ts — used exclusively during `npm run build:export`.
// Free of `db` imports and `'use cache'` directives so Next.js static export runs seamlessly.

import {
  getStaticAllProductSlugs,
  getStaticCategories,
  getStaticFeaturedProducts,
  getStaticProductBySlug,
  getStaticProducts,
} from '@/lib/static-products';
import type { Product, ProductCardData, ProductPage, ProductVariantData } from '@/lib/static-products';

export type { Product, ProductCardData, ProductPage, ProductVariantData };

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

export async function getProducts(options: {
  page?: number;
  pageSize?: number;
  category?: string;
  q?: string;
  sort?: 'featured' | 'newest' | 'price-asc' | 'price-desc';
  inStock?: boolean;
} = {}): Promise<ProductPage> {
  return getStaticProducts(options);
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  return getStaticFeaturedProducts(limit);
}

export async function getProductsByIds(ids: string[]): Promise<ProductCardData[]> {
  const all = getStaticProducts({ pageSize: 100 }).products;
  return all.filter((p) => ids.includes(p.id));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return getStaticProductBySlug(slug);
}

export async function getAllProductSlugs(): Promise<string[]> {
  return getStaticAllProductSlugs();
}

export async function getCategories(): Promise<string[]> {
  return getStaticCategories();
}

