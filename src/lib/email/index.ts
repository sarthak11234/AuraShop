/**
 * Centralized email module for VEXO.
 *
 * Exports:
 *   - resend: Configured Resend client
   *   - isResendConfigured: Whether credentials are available
   *   - sendEmail: Generic email-sending utility (best-effort, never throws)
   *   - getFrom, getFromEmail, getFromName, getReplyTo: Sender identity helpers
   *   - emailSubject: Subject line formatter
   *   - Template render functions from src/lib/email/templates
 */

export { resend, isResendConfigured } from '@/lib/email/client';
export { sendEmail, type SendEmailInput, type SendEmailResult } from '@/lib/email/send-email';
export {
  getFrom,
  getFromEmail,
  getFromName,
  getReplyTo,
  getBaseUrl,
  emailSubject,
} from '@/lib/email/email-config';

// Template renderers
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

export {
  type OrderConfirmationEmailProps,
  type OrderItemProps,
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
