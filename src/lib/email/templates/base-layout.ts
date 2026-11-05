/**
 * Base layout for all VEXO email templates.
 *
 * Provides a consistent premium fashion-editorial shell:
 *   - VEXO wordmark at top
 *   - Thin divider
 *   - Editorial heading and message
 *   - Prominent primary CTA
 *   - Supporting information
 *   - VEXO tagline and footer
 *
 * All CSS is inlined for email client compatibility. System font stack is used
 * since web fonts are not reliably supported across email clients.
 *
 * Parameters:
 *   heading    - Main heading text
 *   body       - Main body text (plain text, will be HTML-escaped)
 *   ctaLabel   - Call-to-action button label (optional)
 *   ctaUrl     - Call-to-action URL (optional; button only renders if both ctaLabel and ctaUrl are provided)
 *   children   - Additional HTML content (e.g. order details table)
 *   footer     - Additional footer content (optional)
 *   preheader  - Preheader text shown in email inbox preview (optional)
 */

import { escapeHtml } from '@/lib/email/utils/escape-html';

export interface BaseLayoutProps {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  children?: React.ReactNode;
  footer?: string;
  preheader?: string;
}

export function BaseLayout({
  heading,
  body,
  ctaLabel,
  ctaUrl,
  children,
  footer,
  preheader,
}: BaseLayoutProps): string {
  const ctaHtml = ctaLabel && ctaUrl
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
        <tr>
          <td align="center">
            <a href="${escapeHtml(ctaUrl)}"
               style="display:inline-block; background:#FF454F; color:#FFFFFF; text-decoration:none; font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; padding:14px 28px; border-radius:4px; margin-top:24px;">
              ${escapeHtml(ctaLabel)}
            </a>
          </td>
        </tr>
      </table>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0; padding:0; background:#0B0B0D; font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#F4F2F0;">
  ${preheader ? `<div style="display:none; max-height:0px; overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px; background:#18181C; border:1px solid #29292E; border-radius:8px;">
          <!-- Header -->
          <tr>
            <td align="left" style="padding:32px 32px 24px 32px; border-bottom:1px solid #29292E;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:18px; font-weight:bold; letter-spacing:0.18em; text-transform:uppercase; color:#FF454F;">
                    VEXO<span style="color:#F4F2F0;">.</span>
                  </td>
                </tr>
              </table>
              <div style="height:4px; width:48px; background:#FF454F; margin-top:16px;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td align="left" style="padding:0 32px 32px 32px;">
              <h1 style="font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:28px; font-weight:bold; letter-spacing:-0.02em; color:#F4F2F0; margin:0 0 16px 0; line-height:1.2;">
                ${escapeHtml(heading)}
              </h1>
              <p style="font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:15px; line-height:1.6; color:#A6A3A3; margin:0 0 24px 0;">
                ${escapeHtml(body)}
              </p>
              ${ctaHtml}
              ${children ? `<div style="margin-top:24px;">${children}</div>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="left" style="padding:32px; border-top:1px solid #29292E;">
              <p style="font-family:'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.18em; text-transform:uppercase; color:#77747A; margin:0 0 8px 0;">
                FUTURE IS WEARABLE.
              </p>
              <p style="font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:12px; line-height:1.6; color:#77747A; margin:0;">
                Team VEXO
              </p>
              ${footer ? `<p style="font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size:11px; line-height:1.6; color:#77747A; margin:16px 0 0 0;">${footer}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
