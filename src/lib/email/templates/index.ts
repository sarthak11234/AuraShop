/**
 * Barrel export for all email templates.
 *
 * Each template exports:
 *   - A type for its props
 *   - A render* function returning BaseLayoutProps (for HTML rendering)
 *   - A render*Html function returning the full HTML string
 *   - A render*Text function returning the plain-text version
 */

export {
  type OrderItemProps,
  type OrderConfirmationEmailProps,
  renderOrderConfirmationEmail,
  renderOrderConfirmationEmailHtml,
  renderOrderConfirmationEmailText,
} from '@/lib/email/templates/order-confirmation';

export {
  type OrderShippedEmailProps,
  renderOrderShippedEmail,
  renderOrderShippedEmailHtml,
  renderOrderShippedEmailText,
} from '@/lib/email/templates/order-shipped';

export {
  type OrderDeliveredEmailProps,
  renderOrderDeliveredEmail,
  renderOrderDeliveredEmailHtml,
  renderOrderDeliveredEmailText,
} from '@/lib/email/templates/order-delivered';

export {
  type ReturnItemProps,
  type ReturnRequestedEmailProps,
  renderReturnRequestedEmail,
  renderReturnRequestedEmailHtml,
  renderReturnRequestedEmailText,
} from '@/lib/email/templates/return-requested';

export {
  type ReturnItemProps as ReturnApprovedItemProps,
  type ReturnApprovedEmailProps,
  renderReturnApprovedEmail,
  renderReturnApprovedEmailHtml,
  renderReturnApprovedEmailText,
} from '@/lib/email/templates/return-approved';

export {
  type RefundUpdateEmailProps,
  renderRefundUpdateEmail,
  renderRefundUpdateEmailHtml,
  renderRefundUpdateEmailText,
} from '@/lib/email/templates/refund-update';

export {
  type ExchangeUpdateEmailProps,
  renderExchangeUpdateEmail,
  renderExchangeUpdateEmailHtml,
  renderExchangeUpdateEmailText,
} from '@/lib/email/templates/exchange-update';

export {
  type WelcomeEmailProps,
  renderWelcomeEmail,
  renderWelcomeEmailHtml,
  renderWelcomeEmailText,
} from '@/lib/email/templates/welcome';

export {
  type MagicLinkEmailProps,
  renderMagicLinkEmail,
  renderMagicLinkEmailHtml,
  renderMagicLinkEmailText,
} from '@/lib/email/templates/magic-link';

export type { BaseLayoutProps } from '@/lib/email/templates/base-layout';
