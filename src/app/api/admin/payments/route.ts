import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin';

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  return NextResponse.json({
    available: false,
    payments: [],
    reason: 'The current Prisma schema does not persist payment transactions or refund records.',
  });
}
