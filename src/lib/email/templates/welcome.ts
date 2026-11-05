/**
 * Welcome email template for newly registered VEXO customers.
 *
 * Sent once when a customer account is first created. Not sent on subsequent
 * logins to avoid duplicate welcome emails.
 *
 * Parameters:
 *   name      - Customer's name (optional; falls back to "there")
 *   appUrl    - Base URL for the storefront CTA
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface WelcomeEmailProps {
  name?: string | null;
  appUrl: string;
}

export function renderWelcomeEmail({ name, appUrl }: WelcomeEmailProps): BaseLayoutProps {
  const displayName = escapeHtml(name?.trim() || 'there');

  return {
    heading: 'Welcome to VEXO',
    body: `We\u2019re glad to have you with us.\n\nVEXO is more than fashion. It\u2019s a new perspective on form, function and expression \u2014 designed for those who move differently and think ahead.\n\nYour account is now ready. You can explore our latest collections, discover new designs and experience the future of wearable fashion.`,
    ctaLabel: 'Explore the Collections',
    ctaUrl: appUrl,
    footer: 'Stay ahead.\n\nTeam VEXO',
  };
}

/**
 * Renders the full HTML for the welcome email.
 */
export function renderWelcomeEmailHtml(props: WelcomeEmailProps): string {
  const layoutProps = renderWelcomeEmail(props);
  return BaseLayout(layoutProps);
}

/**
 * Renders the plain-text version of the welcome email.
 */
export function renderWelcomeEmailText(props: WelcomeEmailProps): string {
  const displayName = escapeHtml(props.name?.trim() || 'there');
  return `Welcome to VEXO\n\n${displayName},\n\nWe're glad to have you with us.\n\nVEXO is more than fashion. It's a new perspective on form, function and expression \u2014 designed for those who move differently and think ahead.\n\nYour account is now ready. You can explore our latest collections, discover new designs and experience the future of wearable fashion.\n\nFUTURE IS WEARABLE.\n\nThank you for being part of VEXO.\n\nStay ahead.\nTeam VEXO`;
}
