'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function InventoryAdjustmentForm({
  variantId,
  currentStock,
}: {
  variantId: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'increase' | 'decrease' | 'set'>('increase');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0 || (mode !== 'set' && parsedQuantity === 0)) {
      setMessage('Enter a valid whole-number quantity.');
      return;
    }

    const nextValue = mode === 'set'
      ? parsedQuantity
      : currentStock + (mode === 'increase' ? parsedQuantity : -parsedQuantity);
    if (nextValue < 0) {
      setMessage('The adjustment cannot make stock negative.');
      return;
    }
    if (!window.confirm(`Change stock from ${currentStock} to ${nextValue}?`)) return;

    setPending(true);
    try {
      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          mode: mode === 'set' ? 'set' : 'adjust',
          quantity: mode === 'set' ? parsedQuantity : mode === 'increase' ? parsedQuantity : -parsedQuantity,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Stock adjustment failed');
      setReason('');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Stock adjustment failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-w-[260px] flex-col gap-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`inventory-mode-${variantId}`}>Adjustment type</label>
        <select
          id={`inventory-mode-${variantId}`}
          value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)}
          className="min-h-10 border border-line bg-canvas px-2 text-xs"
        >
          <option value="increase">Increase</option>
          <option value="decrease">Decrease</option>
          <option value="set">Set stock</option>
        </select>
        <label className="sr-only" htmlFor={`inventory-quantity-${variantId}`}>Quantity</label>
        <input
          id={`inventory-quantity-${variantId}`}
          type="number"
          min={mode === 'set' ? 0 : 1}
          max={1_000_000}
          step={1}
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="min-h-10 w-20 border border-line bg-canvas px-2 text-sm"
        />
      </div>
      <label className="sr-only" htmlFor={`inventory-reason-${variantId}`}>Adjustment reason</label>
      <input
        id={`inventory-reason-${variantId}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        minLength={8}
        maxLength={500}
        required
        placeholder="Reason (required)"
        className="min-h-10 border border-line bg-canvas px-2 text-xs"
      />
      {message && <span role="alert" className="text-xs text-brand">{message}</span>}
      <button disabled={pending || reason.trim().length < 8} className="min-h-10 border border-brand px-3 text-xs text-brand disabled:opacity-50">
        {pending ? 'Saving…' : 'Record adjustment'}
      </button>
    </form>
  );
}
