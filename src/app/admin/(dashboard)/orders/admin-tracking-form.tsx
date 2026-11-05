'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function toLocalDateTimeInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AdminTrackingForm({
  orderId,
  carrier,
  trackingNumber,
  trackingUrl,
  shippedAt,
  shipped,
}: {
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  shipped: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    carrier: carrier ?? '',
    trackingNumber: trackingNumber ?? '',
    trackingUrl: trackingUrl ?? '',
    shippedAt: toLocalDateTimeInput(shippedAt),
    location: '',
    description: '',
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(orderId)}/tracking`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrier: form.carrier.trim() || null,
            trackingNumber: form.trackingNumber.trim() || null,
            trackingUrl: form.trackingUrl.trim() || null,
            ...(form.shippedAt
              ? { shippedAt: new Date(form.shippedAt).toISOString() }
              : { shippedAt: null }),
            ...(shipped && form.location.trim() ? { location: form.location.trim() } : {}),
            ...(shipped && form.description.trim()
              ? { description: form.description.trim() }
              : {}),
          }),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const apiError =
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Tracking details could not be saved.';
        throw new Error(apiError);
      }
      setMessage('Tracking details saved.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tracking details could not be saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="admin-carrier" className="block text-xs text-ink-secondary">
          Carrier
        </label>
        <input
          id="admin-carrier"
          value={form.carrier}
          onChange={(event) => update('carrier', event.target.value)}
          maxLength={80}
          placeholder="Enter the real carrier name"
          className="mt-1 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="admin-tracking-number" className="block text-xs text-ink-secondary">
          Tracking number
        </label>
        <input
          id="admin-tracking-number"
          value={form.trackingNumber}
          onChange={(event) => update('trackingNumber', event.target.value)}
          maxLength={100}
          placeholder="Enter the real tracking number"
          className="mt-1 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="admin-tracking-url" className="block text-xs text-ink-secondary">
          Tracking URL
        </label>
        <input
          id="admin-tracking-url"
          type="url"
          value={form.trackingUrl}
          onChange={(event) => update('trackingUrl', event.target.value)}
          maxLength={500}
          placeholder="https://"
          className="mt-1 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="admin-shipped-at" className="block text-xs text-ink-secondary">
          Shipped at
        </label>
        <input
          id="admin-shipped-at"
          type="datetime-local"
          value={form.shippedAt}
          onChange={(event) => update('shippedAt', event.target.value)}
          className="mt-1 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
        />
      </div>

      {shipped && (
        <>
          <div>
            <label htmlFor="admin-tracking-location" className="block text-xs text-ink-secondary">
              Event location (optional)
            </label>
            <input
              id="admin-tracking-location"
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
              maxLength={120}
              className="mt-1 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="admin-tracking-description" className="block text-xs text-ink-secondary">
              Shipment note (optional)
            </label>
            <textarea
              id="admin-tracking-description"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full border border-line bg-canvas px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

      <p className="text-[11px] leading-5 text-ink-muted">
        Only enter carrier data you have verified. VEXO has no automatic courier integration
        and will never fabricate tracking events or delivery estimates.
      </p>
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-sm text-brand">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-brand px-4 text-sm font-medium text-canvas disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save tracking details'}
      </button>
    </form>
  );
}
