import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const rawDays = Number.parseInt(new URL(request.url).searchParams.get('days') ?? '30', 10);
  const days = Number.isInteger(rawDays) ? Math.min(90, Math.max(1, rawDays)) : 30;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  start.setUTCHours(0, 0, 0, 0);

  try {
    const daysByDate = await db.$queryRaw<
      { date: Date; grossOrderValue: Prisma.Decimal }[]
    >(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS date, SUM(total) AS "grossOrderValue"
      FROM "Order"
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
        AND status NOT IN ('CANCELLED', 'RETURNED')
      GROUP BY date
      ORDER BY date
    `);

    return NextResponse.json({
      metric: 'grossOrderValue',
      recognizedRevenue: null,
      unavailableReason:
        'Payment records and collection status are not stored in the current database schema.',
      days: daysByDate.map(({ date, grossOrderValue }) => ({
        date: date.toISOString().slice(0, 10),
        grossOrderValue: Number(grossOrderValue),
      })),
    });
  } catch (error) {
    console.error('[GET /api/admin/revenue-chart]', error);
    return NextResponse.json(
      { error: 'Failed to fetch order-value chart data' },
      { status: 500 },
    );
  }
}
