/**
 * Email configuration for VEXO.
 *
 * Centralizes sender identity and application base URL so all email templates
 * and sending logic share the same values. Reads from environment variables
 * only — no secrets are ever embedded in source code.
 */

const DEFAULT_FROM_NAME = 'VEXO';
const DEFAULT_FROM_EMAIL = 'noreply@vexo.store';

/**
 * Sender name used in the From header of all outgoing emails.
 */
export function getFromName(): string {
  return process.env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME;
}

/**
 * Sender email address used in the From header of all outgoing emails.
 * Defaults to the same value used by Auth.js (EMAIL_FROM).
 */
export function getFromEmail(): string {
  return process.env.EMAIL_FROM || DEFAULT_FROM_EMAIL;
}

/**
 * Full sender string formatted as "Name <address>" for Resend.
 */
export function getFrom(): string {
  const name = getFromName();
  const email = getFromEmail();
  return `${name} <${email}>`;
}

/**
 * Application base URL used for constructing absolute links in emails
 * (e.g. magic-link confirmation URLs, order status pages).
 * Falls back to NEXT_PUBLIC_SITE_URL, then to a localhost default.
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000'
  );
}

/**
 * Subject prefix prepended to all VEXO email subjects.
 */
export const EMAIL_SUBJECT_PREFIX = 'VEXO';

/**
 * Builds a consistent subject line: "VEXO — {subject}".
 */
export function emailSubject(subject: string): string {
  return `${EMAIL_SUBJECT_PREFIX} — ${subject}`;
}

/**
 * Reply-to address. Defaults to the same value as the from email.
 */
export function getReplyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO || undefined;
}
