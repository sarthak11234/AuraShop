/**
 * Order delivered email template.
 *
 * Sent when an order's status transitions to DELIVERED.
 *
 * Parameters:
 *   orderNumber   - Order number
 *   orderDate     - Order creation date
 *   customerName  - Customer name (optional)
 *   deliveredAt   - Delivery date (optional)
 *   total         - Order total
 *   currency      - Currency code
 *   appUrl        - Base URL for order link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface OrderDeliveredEmailProps {
  orderNumber: string;
  orderDate: string | Date;
  customerName?: string | null;
  deliveredAt?: string | Date | null;
  total: number;
  currency?: string;
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

export function renderOrderDeliveredEmail({
  orderNumber,
  orderDate,
  customerName,
  deliveredAt,
  total,
  currency = 'USD',
  appUrl,
}: OrderDeliveredEmailProps): BaseLayoutProps {
  return {
    heading: 'Your VEXO order has arrived',
    body: `Your order #${escapeHtml(
      orderNumber,
    )} has been delivered. We hope you enjoy your new pieces.\n\nPlaced on ${formatDate(
      orderDate,
    )}.\n${
      deliveredAt ? `Delivered on ${formatDate(deliveredAt)}.` : ''
    }`,
    ctaLabel: 'View Order',
    ctaUrl: `${appUrl}/account/orders`,
    footer: `Order #${escapeHtml(orderNumber)}\nTotal: ${formatCurrency(total, currency)}`,
  };
}

export function renderOrderDeliveredEmailHtml(props: OrderDeliveredEmailProps): string {
  const layoutProps = renderOrderDeliveredEmail(props);
  return BaseLayout(layoutProps);
}

export function renderOrderDeliveredEmailText(props: OrderDeliveredEmailProps): string {
  const lines = [
    'Your VEXO order has arrived',
    '',
    `Your order #${props.orderNumber} has been delivered. We hope you enjoy your new pieces.`,
    `Placed on ${formatDate(props.orderDate)}`,
  ];
  if (props.deliveredAt) {
    lines.push(`Delivered on ${formatDate(props.deliveredAt)}`);
  }
  lines.push(
    '',
    `FUTURE IS WEARABLE.`,
    `Team VEXO`,
  );
  return lines.filter(Boolean).join('\n');
}
