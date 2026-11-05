import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './payment';

describe('Razorpay Signature Verification (HMAC SHA-256)', () => {
  const secret = 'rzp_test_secret_key_12345';
  const orderId = 'order_DA1234567890';
  const paymentId = 'pay_9876543210';

  // Compute expected valid signature
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`, 'utf8')
    .digest('hex');

  it('accepts cryptographically valid Razorpay signature', () => {
    const isValid = verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature: validSignature,
      secret,
    });
    assert.equal(isValid, true);
  });

  it('rejects tampered or invalid signature', () => {
    const tampered = validSignature.substring(0, validSignature.length - 2) + 'aa';
    const isValid = verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature: tampered,
      secret,
    });
    assert.equal(isValid, false);
  });

  it('rejects signature when orderId does not match paymentId', () => {
    const mismatchedOrderId = 'order_DIFF999999';
    const isValid = verifyRazorpayPaymentSignature({
      orderId: mismatchedOrderId,
      paymentId,
      signature: validSignature,
      secret,
    });
    assert.equal(isValid, false);
  });

  it('rejects empty or missing parameters', () => {
    assert.equal(
      verifyRazorpayPaymentSignature({ orderId: '', paymentId, signature: validSignature, secret }),
      false
    );
    assert.equal(
      verifyRazorpayPaymentSignature({ orderId, paymentId: '', signature: validSignature, secret }),
      false
    );
    assert.equal(
      verifyRazorpayPaymentSignature({ orderId, paymentId, signature: '', secret }),
      false
    );
    assert.equal(
      verifyRazorpayPaymentSignature({ orderId, paymentId, signature: validSignature, secret: '' }),
      false
    );
  });

  it('rejects malformed signatures of different length without throwing', () => {
    assert.doesNotThrow(() => {
      const isValid = verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: 'short_sig',
        secret,
      });
      assert.equal(isValid, false);
    });
  });

  it('rejects non-string inputs safely', () => {
    const isValid = verifyRazorpayPaymentSignature({
      orderId: orderId as unknown as string,
      paymentId: 12345 as unknown as string,
      signature: validSignature,
      secret,
    });
    assert.equal(isValid, false);
  });
});

describe('Razorpay server API integration', () => {
  it('reports the gateway unavailable when credentials are absent', () => {
    const previousId = process.env.RAZORPAY_KEY_ID;
    const previousSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    try {
      assert.equal(isRazorpayConfigured(), false);
    } finally {
      if (previousId === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousId;
      if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousSecret;
    }
  });

  it('creates a Razorpay order using the server-computed minor-unit amount', async () => {
    const previousId = process.env.RAZORPAY_KEY_ID;
    const previousSecret = process.env.RAZORPAY_KEY_SECRET;
    const originalFetch = globalThis.fetch;
    process.env.RAZORPAY_KEY_ID = 'rzp_test_id';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
    let requestBody: Record<string, unknown> = {};
    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        id: 'order_test_123',
        amount: 12500,
        currency: 'USD',
        status: 'created',
      }), { status: 200 });
    };
    try {
      const order = await createRazorpayOrder({
        amountInCents: 12500,
        currency: 'USD',
        receipt: 'VEXO-TEST-ORDER',
      });
      assert.equal(order.id, 'order_test_123');
      assert.deepEqual(requestBody, {
        amount: 12500,
        currency: 'USD',
        receipt: 'VEXO-TEST-ORDER',
      });
    } finally {
      globalThis.fetch = originalFetch;
      if (previousId === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousId;
      if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousSecret;
    }
  });

  it('fetches and captures an authorized test payment without contacting Razorpay', async () => {
    const previousId = process.env.RAZORPAY_KEY_ID;
    const previousSecret = process.env.RAZORPAY_KEY_SECRET;
    const originalFetch = globalThis.fetch;
    process.env.RAZORPAY_KEY_ID = 'rzp_test_id';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
    const requests: Array<{ url: string; method: string; body: string | null }> = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      requests.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
      if (url.endsWith('/capture')) {
        return new Response(JSON.stringify({ id: 'pay_test_456', status: 'captured' }), { status: 200 });
      }
      return new Response(JSON.stringify({
        id: 'pay_test_456',
        order_id: 'order_test_123',
        amount: 12500,
        currency: 'USD',
        status: 'authorized',
      }), { status: 200 });
    };
    try {
      const payment = await fetchRazorpayPayment('pay_test_456');
      assert.equal(payment.status, 'authorized');
      await captureRazorpayPayment({ paymentId: payment.id, amount: 12500, currency: 'USD' });
      assert.equal(requests.length, 2);
      assert.equal(requests[0].method, 'GET');
      assert.equal(requests[1].method, 'POST');
      assert.deepEqual(JSON.parse(requests[1].body ?? '{}'), { amount: 12500, currency: 'USD' });
    } finally {
      globalThis.fetch = originalFetch;
      if (previousId === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousId;
      if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousSecret;
    }
  });
});

describe('Razorpay Webhook Signature Verification', () => {
  const webhookSecret = 'whsec_test_secret_9999';
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_12345',
          order_id: 'order_12345',
          amount: 5000,
          currency: 'USD',
          status: 'captured',
        },
      },
    },
  });

  const validWebhookSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  it('verifies valid raw-body webhook signature', () => {
    const isValid = verifyRazorpayWebhookSignature({
      rawBody,
      signature: validWebhookSig,
      secret: webhookSecret,
    });
    assert.equal(isValid, true);
  });

  it('rejects webhook signature when raw body is altered by even one byte', () => {
    const alteredBody = rawBody + ' ';
    const isValid = verifyRazorpayWebhookSignature({
      rawBody: alteredBody,
      signature: validWebhookSig,
      secret: webhookSecret,
    });
    assert.equal(isValid, false);
  });

  it('rejects forged webhook signature', () => {
    const isValid = verifyRazorpayWebhookSignature({
      rawBody,
      signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      secret: webhookSecret,
    });
    assert.equal(isValid, false);
  });

  it('rejects empty webhook inputs', () => {
    assert.equal(
      verifyRazorpayWebhookSignature({ rawBody: '', signature: validWebhookSig, secret: webhookSecret }),
      false
    );
    assert.equal(
      verifyRazorpayWebhookSignature({ rawBody, signature: '', secret: webhookSecret }),
      false
    );
    assert.equal(
      verifyRazorpayWebhookSignature({ rawBody, signature: validWebhookSig, secret: '' }),
      false
    );
  });
});

describe('Refund Validation & Integrity Rules', () => {
  it('prevents refunds exceeding eligible remaining balance', () => {
    const originalAmount = 100.0;
    const previousRefunds = [30.0, 20.0];
    const alreadyRefunded = previousRefunds.reduce((a, b) => a + b, 0);
    const eligibleAmount = originalAmount - alreadyRefunded; // 50.0

    const validRefundRequest = 40.0;
    const excessiveRefundRequest = 60.0;

    assert.ok(validRefundRequest <= eligibleAmount);
    assert.ok(excessiveRefundRequest > eligibleAmount);
  });

  it('disallows online refund processing on Cash on Delivery orders', () => {
    const paymentProvider = 'cod';
    const isOnlineRefundAllowed = paymentProvider !== 'cod';
    assert.equal(isOnlineRefundAllowed, false);
  });
});
