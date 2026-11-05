'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

type ReturnItemEligibility = {
  eligible: boolean;
  reasons: string[];
  maxReturnableQuantity: number;
};

type ReturnPolicyData = {
  eligible: boolean;
  reasons: string[];
  items: Array<{
    orderItemId: number;
    productId: string;
    productTitle: string;
    variantId: string | null;
    size: string | null;
    purchasedQuantity: number;
    alreadyReturnedQuantity: number;
    eligibility: ReturnItemEligibility;
  }>;
};

export default function NewReturnPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string | undefined;

  const [policy, setPolicy] = useState<ReturnPolicyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    fetch(
      `/api/account/returns/eligibility?orderId=${encodeURIComponent(orderId)}`,
      { cache: 'no-store' },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load return eligibility');
        const data = await res.json();
        if (!cancelled) setPolicy(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load return eligibility');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!orderId) {
    router.replace('/account/orders');
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-24 text-ink-primary">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-2xl font-semibold text-ink-primary">
            Unable to load order
          </h1>
          <p className="mt-3 text-sm text-ink-secondary">{error}</p>
          <button
            onClick={() => router.replace('/account/orders')}
            className="mt-6 inline-flex min-h-11 items-center bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas hover:bg-brand-hover"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  if (!policy || !policy.eligible) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-24 text-ink-primary">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-2xl font-semibold text-ink-primary">
            Return not available
          </h1>
          <ul className="mt-4 space-y-2 text-sm text-ink-secondary">
            {policy?.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <button
            onClick={() => router.replace('/account/orders')}
            className="mt-6 inline-flex min-h-11 items-center bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas hover:bg-brand-hover"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const formData = new FormData(formRef.current!);
    const returnReason = formData.get('returnReason') as string;
    const customerComments = (formData.get('customerComments') as string) || undefined;

    // Collect selected items and quantities.
    const items: Array<{ orderItemId: number; quantity: number }> = [];
    for (const [key, value] of formData.entries()) {
      if (key.endsWith('.selected') && value === 'true') {
        const match = key.match(/^items\[(\d+)\]\.selected$/);
        if (match) {
          const orderItemId = Number.parseInt(match[1], 10);
          const qtyKey = `items[${orderItemId}].quantity`;
          const qtyValue = formData.get(qtyKey);
          const quantity = qtyValue ? Number.parseInt(qtyValue as string, 10) : 1;
          items.push({ orderItemId, quantity });
        }
      }
    }

    try {
      const res = await fetch('/api/account/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          returnReason,
          returnType: 'REFUND',
          customerComments,
          items,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(
          (body as { error?: string }).error || 'Failed to create return request',
        );
      }

      await router.replace('/account/returns');
      await router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-24 sm:px-6 lg:px-8 text-ink-primary">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink-primary">
          Return items
        </h1>
        <p className="mt-3 text-sm text-ink-secondary">
          Order {orderId.slice(-6).toUpperCase()} · Select the items and quantities you would
          like to return.
        </p>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-8 space-y-6 border border-line bg-surface p-5 sm:p-6"
        >
          <input name="orderId" type="hidden" value={orderId} />
          <input name="returnType" type="hidden" value="REFUND" />

          <div className="space-y-4">
            <label htmlFor="return-reason" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Return reason
            </label>
            <select
              id="return-reason"
              name="returnReason"
              className="mt-1 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
              required
            >
              <option value="WRONG_SIZE">Wrong size</option>
              <option value="WRONG_PRODUCT">Wrong product received</option>
              <option value="DAMAGED">Damaged product</option>
              <option value="DEFECTIVE">Defective product</option>
              <option value="DIFFERS_FROM_DESCRIPTION">
                Product differs from description
              </option>
              <option value="QUALITY_ISSUE">Quality issue</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-4">
            <label htmlFor="return-comments" className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Additional comments (optional)
            </label>
            <textarea
              id="return-comments"
              name="customerComments"
              rows={3}
              className="mt-1 min-h-[80px] w-full border border-line bg-canvas px-3 py-2 text-sm"
              placeholder="Tell us more about why you are returning this item…"
            />
          </div>

          <fieldset className="border border-line p-3">
            <legend className="px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
              Items to return
            </legend>
            <ul className="mt-4 space-y-3">
              {policy.items.map((item) => (
                <li
                  key={item.orderItemId}
                  className="flex items-start gap-3 py-2 border-b border-line last:border-b-0"
                >
                  <input
                    type="checkbox"
                    name={`items[${item.orderItemId}].selected`}
                    value="true"
                    defaultChecked={item.eligibility.eligible}
                    className="mt-1 text-brand"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-primary">
                      {item.productTitle}{item.size ? ` · ${item.size}` : ''}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Purchased: {item.purchasedQuantity} ·{' '}
                      Returnable: {item.eligibility.maxReturnableQuantity}
                    </p>
                    <input
                      name={`items[${item.orderItemId}].quantity`}
                      type="number"
                      min="1"
                      max={item.eligibility.maxReturnableQuantity}
                      defaultValue={
                        Math.min(1, item.eligibility.maxReturnableQuantity)
                      }
                      className="mt-1 min-h-10 w-20 border border-line bg-canvas px-2 text-sm"
                      disabled={!item.eligibility.eligible}
                    />
                    {!item.eligibility.eligible && (
                      <p className="mt-1 text-[10px] text-brand">
                        {item.eligibility.reasons.join(' ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </fieldset>

          {submitError && (
            <p className="text-[10px] text-brand">{submitError}</p>
          )}

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit return request'}
            </button>
            <Link
              href="/account/orders"
              className="min-h-11 inline-flex items-center border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary hover:border-brand hover:text-ink-primary"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
