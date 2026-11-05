/**
 * Generic email-sending utility used by all VEXO email templates.
 *
 * Provides a single, auditable entry point for every outgoing email. All
 * errors are caught and logged — email delivery failure must never roll back
 * a successful business operation (order, refund, return, etc.).
 *
 * Usage:
 *
 *   import { sendEmail } from '@/lib/email/send-email';
   *   await sendEmail({
   *     to: 'customer@example.com',
   *     subject: emailSubject('Welcome to VEXO'),
   *     html: renderWelcomeEmail({ name: 'Ada' }),
   *     text: 'Welcome to VEXO...',
   *   });
 */

import { Resend } from 'resend';
import { resend, isResendConfigured } from '@/lib/email/client';
import { getFrom, getReplyTo } from '@/lib/email/email-config';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Result of a send attempt. Always resolved — errors are caught internally
 * and logged, never thrown, so callers can treat email as best-effort.
 */
export type SendEmailResult =
  | { kind: 'sent'; messageId: string }
  | { kind: 'skipped'; reason: 'not-configured' | 'invalid-recipient' }
  | { kind: 'failed'; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

/**
 * Sends an email via Resend. Never throws — all failures are caught and
 * returned as a failed result so callers can treat email as best-effort.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    console.error(
      '[sendEmail] Resend is not configured. Set AUTH_RESEND_KEY (or RESEND_API_KEY) and EMAIL_FROM in .env.local.',
    );
    return { kind: 'skipped', reason: 'not-configured' };
  }

  if (!isValidEmail(input.to)) {
    return { kind: 'skipped', reason: 'invalid-recipient' };
  }

  try {
    const response = await resend.emails.send({
      from: getFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });

    if (response.error) {
      console.error('[sendEmail] Resend API error:', response.error);
      return { kind: 'failed', error: response.error.message };
    }

    return { kind: 'sent', messageId: response.data?.id ?? 'unknown' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sendEmail] Unexpected error:', message);
    return { kind: 'failed', error: message };
  }
}
