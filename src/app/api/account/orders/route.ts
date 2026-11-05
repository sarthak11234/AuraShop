import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import {
  CUSTOMER_ORDER_PAGE_SIZE,
  getCustomerOrderList,
  isCustomerOrderStatus,
  parseCustomerOrderPage,
  parseCustomerOrderSort,
  serializeCustomerOrderList,
} from '@/lib/account-orders';

export async function GET(request: Request) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');
  const sort = parseCustomerOrderSort(searchParams.get('sort'));
  const page = parseCustomerOrderPage(searchParams.get('page'));

  let status = undefined;
  if (statusParam && statusParam !== 'all') {
    if (!isCustomerOrderStatus(statusParam)) {
      return NextResponse.json({ error: 'Invalid order status filter' }, { status: 400 });
    }
    status = statusParam;
  }

  try {
    const result = await getCustomerOrderList({
      userId,
      status,
      sort,
      page,
      pageSize: CUSTOMER_ORDER_PAGE_SIZE,
    });

    return NextResponse.json({
      orders: result.orders.map(serializeCustomerOrderList),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      filters: { status: status ?? 'all', sort },
    });
  } catch (error) {
    console.error('[GET /api/account/orders]', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
