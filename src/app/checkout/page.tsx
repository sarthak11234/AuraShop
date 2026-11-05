'use client';

import { useEffect, useRef, useState } from 'react';
import { useCartStore } from '@/store/cartStore';
import Link from 'next/link';
import Script from 'next/script';

type RazorpayResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: {
    metadata?: {
      payment_id?: string;
    };
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (result: RazorpayResult) => void | Promise<void>;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
      on: (event: 'payment.failed', handler: (result: RazorpayFailure) => void | Promise<void>) => void;
    };
  }
}

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const checkoutIdentity = useRef<{ idempotencyKey: string; token: string } | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayAvailable, setRazorpayAvailable] = useState<boolean | null>(null);
  const [razorpayScriptReady, setRazorpayScriptReady] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: string;
    orderNumber: string;
    total: number;
    paymentMethod: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/payment/razorpay')
      .then(async (response) => {
        const result: unknown = await response.json();
        if (
          !response.ok ||
          typeof result !== 'object' ||
          result === null ||
          !('available' in result) ||
          typeof result.available !== 'boolean'
        ) {
          throw new Error('Unable to check online payment availability.');
        }
        if (active) setRazorpayAvailable(result.available);
      })
      .catch(() => {
        if (active) setRazorpayAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const subtotal = items.reduce(
    (acc, item) => acc + (item.price ?? 0) * (item.quantity ?? 1),
    0
  );
  const shipping = subtotal >= 150 ? 0 : 15.0;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + tax + shipping) * 100) / 100;

  const selectPaymentMethod = (method: 'cod' | 'razorpay') => {
    if (method !== paymentMethod) checkoutIdentity.current = null;
    setPaymentMethod(method);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === 'razorpay' && (!razorpayAvailable || !razorpayScriptReady)) {
      setError('Online payment is unavailable. Choose Cash on Delivery or try again later.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    let keepSubmitting = false;

    try {
      const identity = checkoutIdentity.current ?? {
        idempotencyKey: crypto.randomUUID(),
        token: crypto.randomUUID(),
      };
      checkoutIdentity.current = identity;
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          size: i.size,
          quantity: i.quantity,
        })),
        customerInfo: {
          email,
          firstName,
          lastName,
          phone,
        },
        shippingAddress: {
          firstName,
          lastName,
          phone,
          addressLine1,
          city,
          state,
          postalCode,
          country: 'USA',
        },
        paymentMethod,
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': identity.idempotencyKey,
          'X-Checkout-Token': identity.token,
        },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json();
      if (typeof data !== 'object' || data === null) {
        throw new Error('The checkout service returned an invalid response.');
      }
      if (!res.ok) {
        throw new Error('error' in data && typeof data.error === 'string' ? data.error : 'Failed to complete checkout');
      }

      if (
        !('orderId' in data) ||
        typeof data.orderId !== 'string' ||
        !('orderNumber' in data) ||
        typeof data.orderNumber !== 'string' ||
        !('total' in data) ||
        typeof data.total !== 'number'
      ) {
        throw new Error('The checkout service did not return a valid order.');
      }
      const orderId = data.orderId;
      const orderNumber = data.orderNumber;
      const orderTotal = data.total;

      if (paymentMethod === 'cod') {
        const codResponse = await fetch('/api/payment/cod', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Checkout-Token': identity.token,
          },
          body: JSON.stringify({ orderId }),
        });
        const codResult: unknown = await codResponse.json();
        if (!codResponse.ok) {
          throw new Error(
            typeof codResult === 'object' &&
              codResult !== null &&
              'error' in codResult &&
              typeof codResult.error === 'string'
              ? codResult.error
              : 'Unable to confirm Cash on Delivery.',
          );
        }
        clearCart();
        checkoutIdentity.current = null;
        setConfirmedOrder({
          orderId,
          orderNumber,
          total: orderTotal,
          paymentMethod: 'cod',
        });
        return;
      }

      const orderResponse = await fetch('/api/payment/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Checkout-Token': identity.token,
        },
        body: JSON.stringify({ orderId }),
      });
      const razorpayOrder: unknown = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(
          typeof razorpayOrder === 'object' &&
            razorpayOrder !== null &&
            'error' in razorpayOrder &&
            typeof razorpayOrder.error === 'string'
            ? razorpayOrder.error
            : 'Unable to start online payment.',
        );
      }
      if (
        typeof razorpayOrder !== 'object' ||
        razorpayOrder === null ||
        !('key_id' in razorpayOrder) ||
        typeof razorpayOrder.key_id !== 'string' ||
        !('razorpay_order_id' in razorpayOrder) ||
        typeof razorpayOrder.razorpay_order_id !== 'string' ||
        !('amount' in razorpayOrder) ||
        typeof razorpayOrder.amount !== 'number' ||
        !('currency' in razorpayOrder) ||
        typeof razorpayOrder.currency !== 'string'
      ) {
        throw new Error('The payment service returned an invalid order.');
      }
      if (!window.Razorpay) {
        throw new Error('The secure payment window could not be loaded. Please try again or choose Cash on Delivery.');
      }

      const paymentWindow = new window.Razorpay({
        key: razorpayOrder.key_id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'VEXO',
        order_id: razorpayOrder.razorpay_order_id,
        prefill: { name: `${firstName} ${lastName}`, email, contact: phone },
        theme: { color: '#b7ff3c' },
        handler: async (result) => {
          try {
            const verification = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Checkout-Token': identity.token,
              },
              body: JSON.stringify({ ...result, orderId }),
            });
            const verificationResult: unknown = await verification.json();
            if (!verification.ok) {
              throw new Error(
                typeof verificationResult === 'object' &&
                  verificationResult !== null &&
                  'error' in verificationResult &&
                  typeof verificationResult.error === 'string'
                  ? verificationResult.error
                  : 'Payment verification failed. Do not retry if you were charged.',
              );
            }
            clearCart();
            checkoutIdentity.current = null;
            setConfirmedOrder({
              orderId,
              orderNumber,
              total: orderTotal,
              paymentMethod: 'razorpay',
            });
          } catch (verificationError) {
            setError(
              verificationError instanceof Error
                ? verificationError.message
                : 'Payment verification failed. Do not retry if you were charged.',
            );
            setIsSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            setError('Payment was not completed. Your cart is unchanged.');
          },
        },
      });
      paymentWindow.on('payment.failed', async (failure) => {
        const paymentId = failure.error?.metadata?.payment_id;
        if (!paymentId) {
          setError('Payment failed but could not be verified yet. Do not retry if you were charged.');
          return;
        }
        try {
          const failureResponse = await fetch('/api/payment/razorpay/fail', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Checkout-Token': identity.token,
            },
            body: JSON.stringify({ orderId, paymentId }),
          });
          const failureResult: unknown = await failureResponse.json();
          if (!failureResponse.ok) {
            throw new Error(
              typeof failureResult === 'object' &&
                failureResult !== null &&
                'error' in failureResult &&
                typeof failureResult.error === 'string'
                ? failureResult.error
                : 'Unable to confirm payment failure.',
            );
          }
          paymentWindow.close();
          setError('Payment was not completed. You may safely retry or choose Cash on Delivery.');
          setIsSubmitting(false);
        } catch (failureError) {
          setError(
            failureError instanceof Error
              ? failureError.message
              : 'Unable to confirm payment failure. Please wait before retrying.',
          );
          setIsSubmitting(false);
        }
      });
      paymentWindow.open();
      keepSubmitting = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      if (!keepSubmitting) setIsSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="min-h-screen bg-canvas text-ink-primary flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-line bg-surface p-8 text-center rounded-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            ✓
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-brand">Order Confirmed</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink-primary">
            {confirmedOrder.orderNumber}
          </h2>
          <p className="mt-3 text-sm text-ink-secondary">
            Thank you for your purchase. We have received your order.
          </p>
          <div className="mt-6 border-t border-b border-line py-4 space-y-2 text-sm text-left">
            <div className="flex justify-between">
              <span className="text-ink-secondary">Payment Method</span>
              <span className="font-mono uppercase">{confirmedOrder.paymentMethod}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-ink-secondary">Amount Due</span>
              <span className="text-brand">${confirmedOrder.total.toFixed(2)}</span>
            </div>
          </div>
          <Link
            href="/collections"
            className="mt-6 inline-block w-full py-3 bg-brand text-primary-foreground font-mono text-xs uppercase tracking-wider rounded-md hover:bg-brand/90"
          >
            Back to Catalogue
          </Link>
          <Link
            href="/account/orders"
            className="mt-3 inline-block w-full py-3 border border-line text-ink-secondary font-mono text-xs uppercase tracking-wider rounded-md hover:border-brand hover:text-ink-primary"
          >
            View Order History
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-bold text-ink-primary mb-3">Cart is Empty</h2>
          <p className="text-ink-secondary mb-6 text-sm">
            Add units from the catalogue to begin checkout.
          </p>
          <Link
            href="/collections"
            className="inline-block px-6 py-3 bg-brand text-primary-foreground font-mono text-xs uppercase tracking-wider rounded-md hover:bg-brand/90"
          >
            Browse Catalogue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink-primary">
      <header className="border-b border-line bg-surface/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold tracking-[0.2em] text-ink-primary">
            VEXO
          </Link>
          <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">Secure Checkout</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-10">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <section className="border border-line bg-surface p-6 rounded-lg">
              <h2 className="font-mono text-xs uppercase tracking-wider text-brand mb-4">
                1. Customer Details
              </h2>
              {error && (
                <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkout-first-name" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">First Name</label>
                  <input
                    id="checkout-first-name"
                    name="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-last-name" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">Last Name</label>
                  <input
                    id="checkout-last-name"
                    name="lastName"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-email" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">Email Address</label>
                  <input
                    id="checkout-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-phone" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">Phone Number</label>
                  <input
                    id="checkout-phone"
                    name="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 019 2831"
                    className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                  />
                </div>
              </div>
            </section>

            <section className="border border-line bg-surface p-6 rounded-lg">
              <h2 className="font-mono text-xs uppercase tracking-wider text-brand mb-4">
                2. Shipping Destination
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="checkout-address" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">Street Address</label>
                  <input
                    id="checkout-address"
                    name="addressLine1"
                    type="text"
                    required
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="checkout-city" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">City</label>
                    <input
                      id="checkout-city"
                      name="city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-state" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">State / Province</label>
                    <input
                      id="checkout-state"
                      name="state"
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-postal-code" className="block text-[11px] uppercase tracking-wider text-ink-muted mb-1">Postal Code</label>
                    <input
                      id="checkout-postal-code"
                      name="postalCode"
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink-primary"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-line bg-surface p-6 rounded-lg">
              <h2 className="font-mono text-xs uppercase tracking-wider text-brand mb-4">
                3. Payment Method
              </h2>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-line rounded cursor-pointer hover:border-brand">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => selectPaymentMethod('cod')}
                  />
                  <div>
                    <div className="text-sm font-medium">Cash on Delivery (COD)</div>
                    <div className="text-xs text-ink-muted">Pay securely upon package delivery</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-line rounded cursor-pointer hover:border-brand">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay'}
                    disabled={!razorpayAvailable}
                    onChange={() => selectPaymentMethod('razorpay')}
                  />
                  <div>
                    <div className="text-sm font-medium">Razorpay Online Gateway</div>
                    <div className="text-xs text-ink-muted">
                      {razorpayAvailable === null
                        ? 'Checking gateway availability'
                        : razorpayAvailable
                          ? 'Credit/Debit Card, UPI, NetBanking'
                          : 'Unavailable — gateway credentials are not configured'}
                    </div>
                  </div>
                </label>
              </div>
              {paymentMethod === 'razorpay' && razorpayAvailable && (
                <Script
                  src="https://checkout.razorpay.com/v1/checkout.js"
                  strategy="afterInteractive"
                  onReady={() => setRazorpayScriptReady(true)}
                  onError={() => {
                    setRazorpayScriptReady(false);
                    setError('The secure payment window could not be loaded. Choose Cash on Delivery or try again later.');
                  }}
                />
              )}
            </section>
          </div>

          <div className="lg:col-span-5">
            <div className="border border-line bg-surface p-6 rounded-lg sticky top-24 space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted border-b border-line pb-3">
                Order Summary ({items.length} units)
              </h3>
              <div className="max-h-60 overflow-y-auto space-y-3 pr-2 divide-y divide-line">
                {items.map((item) => (
                  <div key={item.key} className="pt-2 flex justify-between text-xs">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-ink-muted">Size: {item.size} × {item.quantity}</p>
                    </div>
                    <p className="font-mono">${((item.price ?? 0) * (item.quantity ?? 1)).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-line pt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Subtotal</span>
                  <span className="font-mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Shipping</span>
                  <span className="font-mono">{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Estimated Tax</span>
                  <span className="font-mono">${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-line pt-2 flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="font-mono text-brand">${total.toFixed(2)}</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (paymentMethod === 'razorpay' && (!razorpayAvailable || !razorpayScriptReady))
                }
                className="w-full py-3 bg-brand text-primary-foreground font-mono text-xs uppercase tracking-wider rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? paymentMethod === 'razorpay' ? 'Waiting for Payment...' : 'Processing Order...'
                  : paymentMethod === 'razorpay' ? 'Pay Securely' : 'Place COD Order'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
