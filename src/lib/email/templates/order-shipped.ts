/**
 * Order shipped email template.
 *
 * Sent when an order's shipping details are recorded (carrier/tracking).
 * Never invents tracking information \u2014 only shows what has been persisted.
 *
 * Parameters:
 *   orderNumber   - Order number
 *   orderDate     - Order creation date
 *   customerName  - Customer name (optional)
 *   carrier       - Carrier name (optional)
 *   trackingNumber - Tracking number (optional)
 *   trackingUrl   - Tracking URL (optional)
 *   shippedAt     - Shipment date (optional)
 *   total         - Order total
 *   currency      - Currency code
 *   appUrl        - Base URL for order link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface OrderShippedEmailProps {
  orderNumber: string;
  orderDate: string | Date;
  customerName?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | Date | null;
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

export function renderOrderShippedEmail({
  orderNumber,
  orderDate,
  customerName,
  carrier,
  trackingNumber,
  trackingUrl,
  shippedAt,
  total,
  currency = 'USD',
  appUrl,
}: OrderShippedEmailProps): BaseLayoutProps {
  const shippingDetails = [];
  if (carrier) shippingDetails.push(escapeHtml(carrier));
  if (trackingNumber) shippingDetails.push(escapeHtml(trackingNumber));

  return {
    heading: 'Your VEXO order is on its way',
    body: `Your order #${escapeHtml(orderNumber)} has been handed to the carrier and is on its way to you.\n\nPlaced on ${formatDate(orderDate)}.\n${
      shippingDetails.length > 0
        ? `Carrier: ${shippingDetails.join(' \u00b7 ')}`
        : ''
    }`,
    ctaLabel: trackingUrl && trackingNumber ? 'Track Your Order' : 'View Order',
    ctaUrl: trackingUrl || `${appUrl}/account/orders`,
    footer: `Order #${escapeHtml(orderNumber)}\nTotal: ${formatCurrency(total, currency)}`,
  };
}

export function renderOrderShippedEmailHtml(props: OrderShippedEmailProps): string {
  const layoutProps = renderOrderShippedEmail(props);
  return BaseLayout(layoutProps);
}

export function renderOrderShippedEmailText(props: OrderShippedEmailProps): string {
  const lines = [
    'Your VEXO order is on its way',
    '',
    `Your order #${props.orderNumber} has been handed to the carrier and is on its way to you.`,
    `Placed on ${formatDate(props.orderDate)}`,
  ];
  if (props.carrier || props.trackingNumber) {
    lines.push(
      `Carrier: ${[props.carrier, props.trackingNumber].filter(Boolean).join(' \u00b7 ')}`,
    );
  }
  lines.push(
    '',
    `FUTURE IS WEARABLE.`,
    `Team VEXO`,
  );
  return lines.filter(Boolean).join('\n');
}
