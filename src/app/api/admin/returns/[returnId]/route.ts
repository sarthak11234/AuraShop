import { NextResponse } from 'next/server';
import { requireAdminApi, rateLimitAdminAction } from '@/lib/admin';
import { db } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ returnId: string }> },
) {
  const { actor, response } = await requireAdminApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitAdminAction(actor.id, 'return-read', 60);
  if (rateLimitResponse) return rateLimitResponse;

  const { returnId } = await params;

  try {
    const returnRequest = await db.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            total: true,
            currency: true,
            payment: {
              select: { provider: true, method: true, status: true, amount: true },
            },
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: { select: { slug: true, category: true } },
            variant: { select: { size: true, sku: true, stock: true } },
            inspections: {
              orderBy: { createdAt: 'desc' },
              include: { inspector: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
        shipment: true,
        exchangeRequest: true,
        offlineRefund: true,
      },
    });

    if (!returnRequest) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 });
    }

    return NextResponse.json({ returnRequest });
  } catch (error) {
    console.error('[GET /api/admin/returns/[returnId]]', error);
    return NextResponse.json({ error: 'Failed to load return' }, { status: 500 });
  }
}
