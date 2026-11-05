/**
 * Exchange update email template.
 *
 * Sent when an exchange request status changes (APPROVED, STOCK_RESERVED, DISPATCHED, COMPLETED).
 * Never claims shipment or completion before the relevant event is persisted.
 *
 * Parameters:
 *   returnRequestId - Return request reference
 *   orderNumber     - Original order number
 *   customerName    - Customer name (optional)
 *   replacementProduct - Replacement product title (optional)
 *   replacementQuantity - Replacement quantity (optional)
 *   status          - Current exchange status
 *   statusLabel     - Human-readable status label
 *   updatedAt       - Update timestamp
 *   appUrl          - Base URL for return link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface ExchangeUpdateEmailProps {
  returnRequestId: string;
  orderNumber: string;
  customerName?: string | null;
  replacementProduct?: string | null;
  replacementQuantity?: number;
  status: string;
  statusLabel: string;
  updatedAt: string | Date;
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Your exchange request is being reviewed',
  APPROVED: 'Your exchange has been approved',
  STOCK_RESERVED: 'Your replacement stock has been reserved',
  DISPATCHED: 'Your replacement has been dispatched',
  COMPLETED: 'Your exchange is complete',
  REJECTED: 'Your exchange request could not be approved',
};

export function renderExchangeUpdateEmail({
  returnRequestId,
  orderNumber,
  customerName,
  replacementProduct,
  replacementQuantity,
  status,
  statusLabel,
  updatedAt,
  appUrl,
}: ExchangeUpdateEmailProps): BaseLayoutProps {
  const replacementLine = replacementProduct
    ? `Replacement: ${escapeHtml(replacementProduct)}` +
      (replacementQuantity ? ` \u00d7 ${replacementQuantity}` : '')
    : '';

  return {
    heading: 'Update on your VEXO exchange',
    body: `Here\u2019s an update on your exchange for order #${escapeHtml(
      orderNumber,
    )}.\n\nExchange #${escapeHtml(returnRequestId)}\nStatus: ${escapeHtml(statusLabel)}.\nUpdated on ${formatDate(
      updatedAt,
    )}.\n${replacementLine ? `${replacementLine}.\n` : ''}\n${status === 'COMPLETED'
      ? 'Your replacement has been dispatched. Thank you for your patience.'
      : status === 'REJECTED'
        ? 'Unfortunately, we were unable to approve your exchange at this time. Please contact support for more information.'
        : 'We\u2019ll notify you again once the exchange status changes.'}`,
    ctaLabel: 'View Exchange',
    ctaUrl: `${appUrl}/account/returns`,
    footer: `Exchange #${escapeHtml(returnRequestId)}\nOrder #${escapeHtml(orderNumber)}`,
  };
}

export function renderExchangeUpdateEmailHtml(props: ExchangeUpdateEmailProps): string {
  const layoutProps = renderExchangeUpdateEmail(props);
  return BaseLayout(layoutProps);
}

export function renderExchangeUpdateEmailText(props: ExchangeUpdateEmailProps): string {
  const lines = [
    'Update on your VEXO exchange',
    '',
    `Here\u2019s an update on your exchange for order #${props.orderNumber}.`,
    '',
    `Exchange #${props.returnRequestId}`,
    `Status: ${props.statusLabel}.`,
    `Updated on ${formatDate(props.updatedAt)}.`,
  ];
  if (props.replacementProduct) {
    lines.push(
      `Replacement: ${props.replacementProduct}${
        props.replacementQuantity ? ` \u00d7 ${props.replacementQuantity}` : ''
      }`,
    );
  }
  lines.push(
    '',
    props.status === 'COMPLETED'
      ? 'Your replacement has been dispatched. Thank you for your patience.'
      : props.status === 'REJECTED'
        ? 'Unfortunately, we were unable to approve your exchange at this time. Please contact support for more information.'
        : 'We\u2019ll notify you again once the exchange status changes.',
    '',
    'FUTURE IS WEARABLE.',
    'Team VEXO',
  );
  return lines.filter(Boolean).join('\n');
}
