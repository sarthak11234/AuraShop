import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Fixed-window rate limiter backed by the existing rate-limit table. The table
 * is keyed by actor + action, so it can protect both admin and customer
 * mutations without introducing a second persistence model.
 */
export async function rateLimitActorAction(
  actorId: string,
  action: string,
  limit = 30,
  windowMs = 60_000,
) {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCSeconds(0, 0);

  const record = await db.adminRateLimit.upsert({
    where: {
      actorId_action_windowStart: { actorId, action, windowStart },
    },
    create: { actorId, action, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  await db.adminRateLimit.deleteMany({
    where: { windowStart: { lt: new Date(windowStart.getTime() - 86_400_000) } },
  });

  if (record.count <= limit) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
  );
  return NextResponse.json(
    { error: 'Too many changes; try again shortly' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
