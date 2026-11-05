'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProfileForm({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const messageFromApi =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Profile could not be saved.';
        throw new Error(messageFromApi);
      }
      setMessage('Profile saved.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Profile could not be saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="profile-name" className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
          Display name
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={64}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 min-h-11 w-full border border-line bg-canvas px-3 text-sm text-ink-primary"
        />
        <p className="mt-1.5 text-xs text-ink-muted">Between 2 and 64 characters.</p>
      </div>

      <div>
        <label htmlFor="profile-phone" className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
          Phone number
        </label>
        <input
          id="profile-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={24}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-2 min-h-11 w-full border border-line bg-canvas px-3 text-sm text-ink-primary"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Optional. Used for delivery contact only. Include 10–20 digits.
        </p>
      </div>

      {message && (
        <p role="status" className="border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-brand">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || name.trim().length < 2}
        className="min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
