import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export type AccountApiAuth =
  | { userId: string; session: Session; response: null }
  | { userId: null; session: null; response: NextResponse };

/** Every account API route authenticates on the server; no client ids are trusted. */
export async function requireAccountApi(): Promise<AccountApiAuth> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      userId: null,
      session: null,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }
  return { userId: session.user.id, session, response: null };
}
