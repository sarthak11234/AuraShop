'use client';

import { useState } from 'react';
import { ORDER_STATUS_TRANSITIONS } from '@/lib/admin-order-status';
import type { OrderStatus } from '@prisma/client';

export function OrderStatusEditor({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const options = ORDER_STATUS_TRANSITIONS[currentStatus as OrderStatus] ?? [];
  const [status, setStatus] = useState<string>(options[0] ?? '');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!status || !window.confirm(`Change order status to ${status.replaceAll('_', ' ')}?`)) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Order status could not be updated');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order status could not be updated');
    } finally {
      setPending(false);
    }
  }

  if (options.length === 0) {
    return <p className="text-sm text-ink-muted">This order has no available status transitions.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-ink-secondary" htmlFor="next-order-status">
        Next status
      </label>
      <select
        id="next-order-status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="min-h-11 w-full border border-line bg-canvas px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
        ))}
      </select>
      <label className="block text-xs text-ink-secondary" htmlFor="order-status-reason">
        Reason (required)
      </label>
      <textarea
        id="order-status-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        required
        minLength={8}
        maxLength={500}
        rows={3}
        className="w-full border border-line bg-canvas px-3 py-2 text-sm"
      />
      {message && <p role="alert" className="text-sm text-brand">{message}</p>}
      <button
        type="submit"
        disabled={pending || reason.trim().length < 8}
        className="min-h-11 bg-brand px-4 text-sm font-medium text-canvas disabled:opacity-50"
      >
        {pending ? 'Updating…' : 'Update status'}
      </button>
    </form>
  );
}
