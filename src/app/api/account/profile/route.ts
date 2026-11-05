import { NextResponse } from 'next/server';
import { requireAccountApi } from '@/lib/account-auth';
import { validateProfileInput } from '@/lib/account-validation';
import { db } from '@/lib/db';
import { rateLimitActorAction } from '@/lib/rate-limit';

export async function PATCH(request: Request) {
  const { userId, response } = await requireAccountApi();
  if (response) return response;

  const rateLimitResponse = await rateLimitActorAction(userId, 'account-profile', 20);
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateProfileInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const user = await db.user.update({
      where: { id: userId },
      data: {
        name: validation.data.name,
        phone: validation.data.phone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        emailVerified: user.emailVerified?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[PATCH /api/account/profile]', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
