/**
 * Return approved email template.
 *
 * Sent when an admin approves a return request (status APPROVED or PARTIALLY_APPROVED).
 *
 * Parameters:
 *   returnNumber      - Return request number
 *   orderNumber       - Original order number
 *   customerName      - Customer name (optional)
 *   items             - Array of { productTitle, approvedQuantity }
 *   returnReason      - Human-readable return reason
 *   approvedAt        - Approval timestamp
 *   appUrl            - Base URL for return link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface ReturnItemProps {
  productTitle: string;
  approvedQuantity: number;
}

export interface ReturnApprovedEmailProps {
  returnNumber: string;
  orderNumber: string;
  customerName?: string | null;
  items: ReturnItemProps[];
  returnReason: string;
  approvedAt: string | Date;
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

export function renderReturnApprovedEmail({
  returnNumber,
  orderNumber,
  customerName,
  items,
  returnReason,
  approvedAt,
  appUrl,
}: ReturnApprovedEmailProps): BaseLayoutProps {
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td align="left" style="padding:8px 0; border-bottom:1px solid #29292E; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; color:#F4F2F0;">
            ${escapeHtml(item.productTitle)}
          </td>
          <td align="right" style="padding:8px 0; border-bottom:1px solid #29292E; font-family:'JetBrains Mono', 'Space Mono', monospace; font-size:11px; color:#A6A3A3;">
            Approved Qty ${item.approvedQuantity}
          </td>
        </tr>
      `,
    )
    .join('');

  return {
    heading: 'Your VEXO return has been approved',
    body: `Good news \u2014 your return request #${escapeHtml(
      returnNumber,
    )} has been approved.\n\nOriginal order #${escapeHtml(
      orderNumber,
    )}.\nApproved on ${formatDate(approvedAt)}.\nReason: ${escapeHtml(returnReason)}.\n\nPlease ship your return using the instructions in your account. Once we receive and inspect your items, we\u2019ll process your refund or exchange.`,
    ctaLabel: 'View Return',
    ctaUrl: `${appUrl}/account/returns`,
    children: `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:24px;">
        <tr>
          <td align="left" style="font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; color:#77747A; padding-bottom:8px;">
            Approved Items
          </td>
        </tr>
        ${itemsHtml}
      </table>
    `,
    footer: `Return #${escapeHtml(returnNumber)}`,
  };
}

export function renderReturnApprovedEmailHtml(props: ReturnApprovedEmailProps): string {
  const layoutProps = renderReturnApprovedEmail(props);
  return BaseLayout(layoutProps);
}

export function renderReturnApprovedEmailText(props: ReturnApprovedEmailProps): string {
  const lines = [
    'Your VEXO return has been approved',
    '',
    `Good news \u2014 your return request #${props.returnNumber} has been approved.`,
    `Original order #${props.orderNumber}.`,
    `Approved on ${formatDate(props.approvedAt)}.`,
    `Reason: ${props.returnReason}`,
    '',
    'Please ship your return using the instructions in your account. Once we receive and inspect your items, we\u2019ll process your refund or exchange.',
    '',
    'Approved Items:',
    ...props.items.map(
      (item) => `  ${item.productTitle} \u00d7 ${item.approvedQuantity}`,
    ),
    '',
    'FUTURE IS WEARABLE.',
    'Team VEXO',
  ];
  return lines.filter(Boolean).join('\n');
}
