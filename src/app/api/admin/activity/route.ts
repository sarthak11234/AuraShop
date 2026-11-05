import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const rawPage = Number.parseInt(new URL(request.url).searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;

  try {
    const [entries, total] = await Promise.all([
      db.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 50,
        take: 50,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          reason: true,
          before: true,
          after: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      }),
      db.adminAuditLog.count(),
    ]);

    return NextResponse.json({
      entries,
      pagination: { page, pageSize: 50, total, totalPages: Math.ceil(total / 50) },
    });
  } catch (error) {
    console.error('[GET /api/admin/activity]', error);
    return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
  }
}
