import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/products';

// GET /api/products?category=TECH&q=neural&page=1&pageSize=12
// Paginated catalogue listing backed by PostgreSQL via src/lib/products.ts.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') ?? undefined;
  const q = searchParams.get('q') ?? undefined;
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = Number.parseInt(searchParams.get('pageSize') ?? '12', 10);

  // Input validation: cap page/pageSize, sanitize strings
  const safePage = Math.max(1, Math.min(1000, Math.trunc(page)));
  const safePageSize = Math.max(1, Math.min(48, Math.trunc(pageSize)));
  const safeCategory = category?.trim().slice(0, 64) ?? undefined;
  const safeQ = q?.trim().slice(0, 128) ?? undefined;

  try {
    const result = await getProducts({
      page: safePage,
      pageSize: safePageSize,
      category: safeCategory,
      q: safeQ,
    });

    return NextResponse.json({
      products: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('[GET /api/products]', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
