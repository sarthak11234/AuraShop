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

  try {
    const result = await getProducts({
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 12 : pageSize,
      category,
      q,
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
