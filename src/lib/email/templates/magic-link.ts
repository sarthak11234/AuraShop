/**
 * Magic-link authentication email template.
 *
 * Sent when a customer requests a sign-in link via Auth.js Resend provider.
 * Uses the actual Auth.js-generated verification URL.
 *
 * Parameters:
 *   email     - Customer's email address
 *   url       - Auth.js verification URL (magic link)
 *   appUrl    - Base URL for reference
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface MagicLinkEmailProps {
  email: string;
  url: string;
  appUrl: string;
}

export function renderMagicLinkEmail({ email, url }: MagicLinkEmailProps): BaseLayoutProps {
  return {
    heading: 'Your VEXO sign-in link',
    body: `Your next step starts here.\n\nWe received a request to sign in to your VEXO account.\n\nUse the button below to securely access your account.\n\nThis link is unique to you and expires after the configured verification period. Do not share it with anyone.\n\nIf you did not request this link, you can safely ignore this email.`,
    ctaLabel: 'Sign In to VEXO',
    ctaUrl: url,
    footer: `If you did not request this link, you can safely ignore this email.\n\nFUTURE IS WEARABLE.\n\nTeam VEXO`,
  };
}

/**
 * Renders the full HTML for the magic-link email.
 */
export function renderMagicLinkEmailHtml(props: MagicLinkEmailProps): string {
  const layoutProps = renderMagicLinkEmail(props);
  return BaseLayout(layoutProps);
}

/**
 * Renders the plain-text version of the magic-link email.
 */
export function renderMagicLinkEmailText(props: MagicLinkEmailProps): string {
  return `Your VEXO sign-in link\n\nYour next step starts here.\n\nWe received a request to sign in to your VEXO account.\n\nUse the link below to securely access your account:\n${props.url}\n\nThis link is unique to you and expires after the configured verification period. Do not share it with anyone.\n\nIf you did not request this link, you can safely ignore this email.\n\nFUTURE IS WEARABLE.\n\nTeam VEXO`;
}
