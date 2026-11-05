import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Role } from '@prisma/client';
import type { EmailProviderSendVerificationRequestParams } from '@auth/core/providers/email';
import { db } from '@/lib/db';
import {
  sendEmail,
  emailSubject,
  renderMagicLinkEmailHtml,
  renderMagicLinkEmailText,
  renderWelcomeEmailHtml,
  renderWelcomeEmailText,
  getBaseUrl,
} from '@/lib/email';

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
    ? [
        Resend({
          apiKey: process.env.AUTH_RESEND_KEY,
          from: process.env.EMAIL_FROM ?? 'noreply@vexo.store',
          /**
           * Send a branded magic-link email instead of Auth.js's default
           * plain text email.
           *
           * The `url` is Auth.js's generated verification URL. We never log
           * or expose the full token — it is only embedded in the email HTML.
           */
          async sendVerificationRequest(
            params: EmailProviderSendVerificationRequestParams,
          ) {
            const { identifier, url } = params;
            const baseUrl = getBaseUrl();
            const html = renderMagicLinkEmailHtml({
              email: identifier,
              url,
              appUrl: baseUrl,
            });
            const text = renderMagicLinkEmailText({
              email: identifier,
              url,
              appUrl: baseUrl,
            });

            try {
              await sendEmail({
                to: identifier,
                subject: emailSubject('Your VEXO sign-in link'),
                html,
                text,
              });
            } catch (error) {
              // Email delivery failure must not block sign-in. Auth.js will
              // still create the verification token and session; the customer
              // can request a new link if delivery fails.
              console.error(
                '[sendVerificationRequest] Email delivery failed:',
                error,
              );
            }
          },
        }),
    ]
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
    /**
     * Send a welcome email when a new customer account is created.
     *
     * `email.verificationRequest` is true only when the user signed in via
     * a magic-link verification link — this is the account creation flow.
     * Regular logins (OAuth, or magic-link after already verified) do not
     * set this flag, so welcome emails are not sent on every login.
     */
    async signIn({
      user,
      account,
      profile,
      email,
    }: {
      user: { id?: string; email?: string | null; name?: string | null };
      account?: { provider: string; type: string } | null;
      profile?: Record<string, unknown> | undefined;
      email?: { verificationRequest?: boolean } | undefined;
    }) {
      // Welcome email: sent once when a new customer account is created
      // via magic-link verification. `email.verificationRequest` is true
      // only when the user clicked a magic-link verification link for the
      // first time. Regular logins do not set this flag.
      if (email?.verificationRequest && user.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: emailSubject('Welcome to VEXO'),
            html: renderWelcomeEmailHtml({
              name: user.name,
              appUrl: getBaseUrl(),
            }),
            text: renderWelcomeEmailText({
              name: user.name,
              appUrl: getBaseUrl(),
            }),
          });
        } catch (error) {
          console.error('[signIn] Welcome email delivery failed:', error);
        }
      }

      return true;
    },
  },
});
