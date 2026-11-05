/**
 * Return requested email template.
 *
 * Sent when a customer submits a return request (status REQUESTED).
 *
 * Parameters:
 *   returnNumber  - Return request number
 *   orderNumber   - Original order number
 *   customerName  - Customer name (optional)
 *   items         - Array of { productTitle, requestedQuantity }
 *   returnReason  - Return reason (human-readable)
 *   requestedAt   - Request timestamp
 *   appUrl        - Base URL for return link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface ReturnItemProps {
  productTitle: string;
  requestedQuantity: number;
}

export interface ReturnRequestedEmailProps {
  returnNumber: string;
  orderNumber: string;
  customerName?: string | null;
  items: ReturnItemProps[];
  returnReason: string;
  requestedAt: string | Date;
  appUrl: string;
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function renderReturnRequestedEmail({
  returnNumber,
  orderNumber,
  customerName,
  items,
  returnReason,
  requestedAt,
  appUrl,
}: ReturnRequestedEmailProps): BaseLayoutProps {
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td align="left" style="padding:8px 0; border-bottom:1px solid #29292E; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; color:#F4F2F0;">
            ${escapeHtml(item.productTitle)}
          </td>
          <td align="right" style="padding:8px 0; border-bottom:1px solid #29292E; font-family:'JetBrains Mono', 'Space Mono', monospace; font-size:11px; color:#A6A3A3;">
            Qty ${item.requestedQuantity}
          </td>
        </tr>
      `,
    )
    .join('');

  return {
    heading: 'VEXO return request received',
    body: `We\u2019ve received your return request for order #${escapeHtml(orderNumber)}.\n\nReturn #${escapeHtml(
      returnNumber,
    )}\nRequested on ${formatDate(requestedAt)}.\nReason: ${escapeHtml(returnReason)}.\n\nWe\u2019ll review your request and get back to you shortly.`,
    ctaLabel: 'View Return',
    ctaUrl: `${appUrl}/account/returns`,
    children: `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:24px;">
        <tr>
          <td align="left" style="font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; color:#77747A; padding-bottom:8px;">
            Items to Return
          </td>
        </tr>
        ${itemsHtml}
      </table>
    `,
    footer: `Return #${escapeHtml(returnNumber)}`,
  };
}

export function renderReturnRequestedEmailHtml(props: ReturnRequestedEmailProps): string {
  const layoutProps = renderReturnRequestedEmail(props);
  return BaseLayout(layoutProps);
}

export function renderReturnRequestedEmailText(props: ReturnRequestedEmailProps): string {
  const lines = [
    'VEXO return request received',
    '',
    `We've received your return request for order #${props.orderNumber}.`,
    '',
    `Return #${props.returnNumber}`,
    `Requested on ${formatDate(props.requestedAt)}.`,
    `Reason: ${props.returnReason}`,
    '',
    'Items to return:',
    ...props.items.map(
      (item) => `  ${item.productTitle} \u00d7 ${item.requestedQuantity}`,
    ),
    '',
    'We\u2019ll review your request and get back to you shortly.',
    '',
    'FUTURE IS WEARABLE.',
    'Team VEXO',
  ];
  return lines.filter(Boolean).join('\n');
}
