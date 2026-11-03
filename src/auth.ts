import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Role } from '@prisma/client';
import { db } from '@/lib/db';

const providers = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })]
    : []),
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })]
    : []),
  ...(process.env.AUTH_RESEND_KEY
    ? [Resend({
        apiKey: process.env.AUTH_RESEND_KEY,
        from: process.env.EMAIL_FROM ?? 'noreply@vexo.store',
      })]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  // Self-hosted app: Auth.js v5 otherwise rejects every request with
  // UntrustedHost outside Vercel's environment detection (all auth routes
  // returned 500 without this).
  trustHost: true,
  providers,
  pages: {
    signIn: '/',         // redirect to homepage — sign-in handled by modal
    error: '/',
  },
  callbacks: {
    // Attach userId + role to session for easy access in components
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role =
          (user as typeof user & { role?: Role }).role ?? 'CUSTOMER';
      }
      return session;
    },
  },
});
