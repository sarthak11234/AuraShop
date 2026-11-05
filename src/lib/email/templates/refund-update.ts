/**
 * Refund update email template.
 *
 * Sent when a refund status changes (REFUND_PENDING, REFUND_PROCESSING, REFUNDED, FAILED).
 * Never claims a refund is complete before reliable confirmation.
 *
 * Parameters:
 *   returnRequestId - Return request reference
 *   orderNumber     - Original order number
 *   customerName    - Customer name (optional)
 *   amount          - Refund amount
 *   currency        - Currency code
 *   method          - Refund method (RAZORPAY, BANK_TRANSFER, UPI, OTHER)
 *   status          - Current refund status
 *   statusLabel     - Human-readable status label
 *   updatedAt       - Update timestamp
 *   appUrl          - Base URL for return link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface RefundUpdateEmailProps {
  returnRequestId: string;
  orderNumber: string;
  customerName?: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  statusLabel: string;
  updatedAt: string | Date;
  appUrl: string;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
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
  PENDING: 'Your refund is being processed',
  PROCESSING: 'Your refund is being processed by our payment partner',
  REFUNDED: 'Your refund has been completed',
  FAILED: 'Your refund could not be processed',
};

export function renderRefundUpdateEmail({
  returnRequestId,
  orderNumber,
  customerName,
  amount,
  currency,
  method,
  status,
  statusLabel,
  updatedAt,
  appUrl,
}: RefundUpdateEmailProps): BaseLayoutProps {
  return {
    heading: 'Update on your VEXO refund',
    body: `Here\u2019s an update on your refund for order #${escapeHtml(
      orderNumber,
    )}.\n\nRefund #${escapeHtml(returnRequestId)}\nAmount: ${formatCurrency(
      amount,
      currency,
    )}\nMethod: ${escapeHtml(method)}\nStatus: ${escapeHtml(statusLabel)}.\nUpdated on ${formatDate(
      updatedAt,
    )}.\n\n${status === 'FAILED'
      ? 'Unfortunately, we were unable to process your refund at this time. Please contact support for assistance.'
      : status === 'REFUNDED'
        ? 'Your refund has been sent. Please allow 3\u201310 business days for the funds to appear in your account, depending on your payment provider.'
        : 'We\u2019ll notify you again once the refund status changes.'}`,
    ctaLabel: 'View Return',
    ctaUrl: `${appUrl}/account/returns`,
    footer: `Refund #${escapeHtml(returnRequestId)}\nOrder #${escapeHtml(orderNumber)}`,
  };
}

export function renderRefundUpdateEmailHtml(props: RefundUpdateEmailProps): string {
  const layoutProps = renderRefundUpdateEmail(props);
  return BaseLayout(layoutProps);
}

export function renderRefundUpdateEmailText(props: RefundUpdateEmailProps): string {
  const lines = [
    'Update on your VEXO refund',
    '',
    `Here\u2019s an update on your refund for order #${props.orderNumber}.`,
    '',
    `Refund #${props.returnRequestId}`,
    `Amount: ${formatCurrency(props.amount, props.currency)}`,
    `Method: ${props.method}`,
    `Status: ${props.statusLabel}.`,
    `Updated on ${formatDate(props.updatedAt)}.`,
    '',
    props.status === 'FAILED'
      ? 'Unfortunately, we were unable to process your refund at this time. Please contact support for assistance.'
      : props.status === 'REFUNDED'
        ? 'Your refund has been sent. Please allow 3\u201310 business days for the funds to appear in your account, depending on your payment provider.'
        : 'We\u2019ll notify you again once the refund status changes.',
    '',
    'FUTURE IS WEARABLE.',
    'Team VEXO',
  ];
  return lines.filter(Boolean).join('\n');
}
