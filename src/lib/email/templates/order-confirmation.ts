/**
 * Order confirmation email template.
 *
 * Sent when an order is successfully created (customer checkout).
 * Uses historical order-item snapshots \u2014 never current catalogue prices.
 *
 * Parameters:
 *   orderNumber   - Order number
 *   orderDate     - Order creation date (ISO string or Date)
 *   customerName  - Customer name (optional)
 *   items         - Array of { productTitle, quantity, price, lineTotal }
 *   subtotal      - Order subtotal
 *   shipping      - Shipping amount
 *   tax           - Tax amount
 *   total         - Order total
 *   currency      - Currency code (default 'USD')
 *   appUrl        - Base URL for order link
 */

import { BaseLayout, type BaseLayoutProps } from '@/lib/email/templates/base-layout';
import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface OrderItemProps {
  productTitle: string;
  quantity: number;
  price: number;
  lineTotal: number;
}

export interface OrderConfirmationEmailProps {
  orderNumber: string;
  orderDate: string | Date;
  customerName?: string | null;
  items: OrderItemProps[];
  subtotal: number;
  shipping: number;
  tax: number;
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

export function renderOrderConfirmationEmail({
  orderNumber,
  orderDate,
  customerName,
  items,
  subtotal,
  shipping,
  tax,
  total,
  currency = 'USD',
  appUrl,
}: OrderConfirmationEmailProps): BaseLayoutProps {
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td align="left" style="padding:8px 0; border-bottom:1px solid #29292E; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; color:#F4F2F0;">
            ${escapeHtml(item.productTitle)} \u00d7 ${item.quantity}
          </td>
          <td align="right" style="padding:8px 0; border-bottom:1px solid #29292E; font-family:'JetBrains Mono', 'Space Mono', monospace; font-size:11px; color:#A6A3A3;">
            ${formatCurrency(item.lineTotal, currency)}
          </td>
        </tr>
      `,
    )
    .join('');

  return {
    heading: 'Your VEXO order is confirmed',
    body: `Thank you for your order, ${escapeHtml(customerName || 'there')}. Your order has been received and is being processed.\n\nOrder #${escapeHtml(orderNumber)}\nPlaced on ${formatDate(orderDate)}.`,
    ctaLabel: 'View Order',
    ctaUrl: `${appUrl}/account/orders`,
    children: `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:24px;">
        <tr>
          <td align="left" style="font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; color:#77747A; padding-bottom:8px;">
            Order Items
          </td>
        </tr>
        ${itemsHtml}
        <tr>
          <td align="left" style="padding:16px 0 8px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; color:#F4F2F0;">
            <strong>Subtotal:</strong> ${formatCurrency(subtotal, currency)}
          </td>
        </tr>
        ${shipping > 0 ? `<tr><td align="left" style="padding:4px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; color:#A6A3A3;">Shipping: ${formatCurrency(shipping, currency)}</td></tr>` : ''}
        ${tax > 0 ? `<tr><td align="left" style="padding:4px 0; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:13px; color:#A6A3A3;">Tax: ${formatCurrency(tax, currency)}</td></tr>` : ''}
        <tr>
          <td align="left" style="padding:12px 0; border-top:1px solid #29292E; font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:14px; font-weight:bold; color:#F4F2F0;">
            Total: ${formatCurrency(total, currency)}
          </td>
        </tr>
      </table>
    `,
    footer: `Order #${escapeHtml(orderNumber)}`,
  };
}

export function renderOrderConfirmationEmailHtml(props: OrderConfirmationEmailProps): string {
  const layoutProps = renderOrderConfirmationEmail(props);
  return BaseLayout(layoutProps);
}

export function renderOrderConfirmationEmailText(props: OrderConfirmationEmailProps): string {
  const lines = [
    `Your VEXO order is confirmed`,
    '',
    `Thank you for your order, ${props.customerName || 'there'}. Your order has been received and is being processed.`,
    '',
    `Order #${props.orderNumber}`,
    `Placed on ${formatDate(props.orderDate)}`,
    '',
    'Items:',
    ...props.items.map(
      (item) =>
        `  ${item.productTitle} \u00d7 ${item.quantity} \u2022 ${formatCurrency(item.lineTotal, props.currency)}`,
    ),
    '',
    `Subtotal: ${formatCurrency(props.subtotal, props.currency)}`,
    props.shipping > 0 ? `Shipping: ${formatCurrency(props.shipping, props.currency)}` : '',
    props.tax > 0 ? `Tax: ${formatCurrency(props.tax, props.currency)}` : '',
    `Total: ${formatCurrency(props.total, props.currency)}`,
    '',
    `FUTURE IS WEARABLE.`,
    `Team VEXO`,
  ];
  return lines.filter(Boolean).join('\n');
}
