import crypto from 'node:crypto';

export interface RazorpayPaymentDetails {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export interface VerifyPaymentSignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}

export interface VerifyWebhookSignatureParams {
  rawBody: string;
  signature: string;
  secret: string;
}

/**
 * Verifies Razorpay payment signature using HMAC SHA-256 and constant-time comparison.
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, secret)
 */
export function verifyRazorpayPaymentSignature({
  orderId,
  paymentId,
  signature,
  secret,
}: VerifyPaymentSignatureParams): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }

  // Prevent malformed or non-string inputs
  if (
    typeof orderId !== 'string' ||
    typeof paymentId !== 'string' ||
    typeof signature !== 'string' ||
    typeof secret !== 'string'
  ) {
    return false;
  }

  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Verifies Razorpay webhook signature using HMAC SHA-256 and constant-time comparison.
 * Formula: HMAC-SHA256(raw_body, secret)
 */
export function verifyRazorpayWebhookSignature({
  rawBody,
  signature,
  secret,
}: VerifyWebhookSignatureParams): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  if (
    typeof rawBody !== 'string' ||
    typeof signature !== 'string' ||
    typeof secret !== 'string'
  ) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Creates an order with Razorpay Orders API.
 */
export async function createRazorpayOrder({
  amountInCents,
  currency = 'USD',
  receipt,
}: {
  amountInCents: number;
  currency?: string;
  receipt?: string;
}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
  }
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    throw new Error('Razorpay order amount must be a positive integer in the currency minor unit.');
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      amount: amountInCents,
      currency,
      receipt,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    const description = isRecord(data) && isRecord(data.error) && typeof data.error.description === 'string'
      ? data.error.description
      : 'Failed to create Razorpay order';
    throw new Error(description);
  }

  if (
    !isRecord(data) ||
    typeof data.id !== 'string' ||
    typeof data.amount !== 'number' ||
    typeof data.currency !== 'string' ||
    typeof data.status !== 'string'
  ) {
    throw new Error('Razorpay returned an invalid order response.');
  }
  return { id: data.id, amount: data.amount, currency: data.currency, status: data.status };
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentDetails> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay payment gateway is not configured.');
  }
  if (!paymentId || !/^pay_[A-Za-z0-9_-]+$/.test(paymentId)) {
    throw new Error('Invalid Razorpay payment identifier.');
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const description = isRecord(data) && isRecord(data.error) && typeof data.error.description === 'string'
      ? data.error.description
      : 'Unable to confirm Razorpay payment status.';
    throw new Error(description);
  }
  if (
    !isRecord(data) ||
    typeof data.id !== 'string' ||
    typeof data.order_id !== 'string' ||
    typeof data.amount !== 'number' ||
    typeof data.currency !== 'string' ||
    typeof data.status !== 'string'
  ) {
    throw new Error('Razorpay returned an invalid payment response.');
  }
  return {
    id: data.id,
    order_id: data.order_id,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
  };
}

export async function captureRazorpayPayment({
  paymentId,
  amount,
  currency,
}: {
  paymentId: string;
  amount: number;
  currency: string;
}): Promise<void> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay payment gateway is not configured.');
  }
  if (!/^pay_[A-Za-z0-9_-]+$/.test(paymentId) || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Invalid Razorpay capture parameters.');
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ amount, currency }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const data: unknown = await response.json();
  if (!response.ok) {
    const description = isRecord(data) && isRecord(data.error) && typeof data.error.description === 'string'
      ? data.error.description
      : 'Unable to capture Razorpay payment.';
    throw new Error(description);
  }
  if (!isRecord(data) || data.status !== 'captured' || data.id !== paymentId) {
    throw new Error('Razorpay did not confirm payment capture.');
  }
}

/**
 * Issues a refund for a captured Razorpay payment.
 */
export async function createRazorpayRefund({
  paymentId,
  amountInCents,
  notes,
}: {
  paymentId: string;
  amountInCents?: number;
  notes?: Record<string, string>;
}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay API credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.');
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const body: Record<string, unknown> = {};
  if (amountInCents && amountInCents > 0) {
    body.amount = amountInCents;
  }
  if (notes) {
    body.notes = notes;
  }

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.description || 'Failed to process Razorpay refund');
  }

  return data as { id: string; amount: number; currency: string; status: string; payment_id: string };
}
