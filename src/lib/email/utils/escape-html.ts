/**
 * HTML escaping utility for email templates.
 *
 * Prevents XSS and broken HTML when user-provided values (names, order
 * numbers, product titles, etc.) are interpolated into HTML email content.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
