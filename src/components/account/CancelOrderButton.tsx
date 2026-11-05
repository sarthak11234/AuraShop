'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch(
        `/api/account/orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() || 'Cancelled by customer' }),
        },
      );
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const message =
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'The order could not be cancelled.';
        throw new Error(message);
      }
      setCancelled(true);
      setIsOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The order could not be cancelled.');
    } finally {
      setPending(false);
    }
  }

  if (cancelled) {
    return (
      <p role="status" className="border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        Order cancelled. The order history and inventory state have been updated.
      </p>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="min-h-11 border border-brand/50 px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-brand transition-colors hover:bg-brand/10"
      >
        Cancel this order
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-brand/40 bg-brand/5 p-4">
      <label htmlFor="cancellation-reason" className="block text-sm text-ink-secondary">
        Reason (optional)
      </label>
      <textarea
        id="cancellation-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Tell us why you are cancelling"
        className="w-full border border-line bg-canvas px-3 py-2 text-sm"
      />
      <p className="text-xs leading-5 text-ink-muted">
        Cancellation is final. Reserved inventory is returned to the catalogue. No refund
        record is created unless a payment was actually collected and processed by support.
      </p>
      {error && (
        <p role="alert" className="text-sm text-brand">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? 'Cancelling…' : 'Confirm cancellation'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          disabled={pending}
          className="min-h-11 border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary hover:text-ink-primary disabled:opacity-50"
        >
          Keep order
        </button>
      </div>
    </form>
  );
}
