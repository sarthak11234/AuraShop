/**
 * Centralized Resend client for VEXO email delivery.
 *
 * A single Resend client instance is shared across the application to avoid
 * creating multiple SDK clients. The API key is read from the environment
 * variable AUTH_RESEND_KEY (the same variable used by Auth.js for magic-link
 * delivery), ensuring consistency and avoiding duplicate credential sources.
 *
 * If RESEND_API_KEY or AUTH_RESEND_KEY is not configured, the client is still
 * instantiated but send operations will fail gracefully with a clear error
 * instead of crashing at module load time.
 */

import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;

/**
 * Resend client instance. If no API key is configured, the client is still
 * created but send operations will fail gracefully with a clear error.
 */
export const resend = apiKey ? new Resend(apiKey) : null as unknown as Resend;

/**
 * Returns true if Resend credentials are configured. When false, all email
 * send operations should fail gracefully and log a clear error instead of
 * silently dropping messages.
 */
export function isResendConfigured(): boolean {
  return Boolean(apiKey);
}
