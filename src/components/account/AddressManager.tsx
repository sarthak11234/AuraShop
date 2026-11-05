'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type AccountAddress = {
  id: number;
  kind: string;
  firstName: string;
  lastName: string;
  company: string | null;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: string;
  updatedAt: string;
};

type AddressFormState = {
  kind: 'shipping' | 'billing';
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

const EMPTY_FORM: AddressFormState = {
  kind: 'shipping',
  firstName: '',
  lastName: '',
  company: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'USA',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

function addressToPayload(address: AccountAddress, overrides: Partial<AddressFormState> = {}) {
  return {
    kind: address.kind,
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company ?? '',
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 ?? '',
    landmark: address.landmark ?? '',
    city: address.city,
    state: address.state ?? '',
    postalCode: address.postalCode,
    country: address.country,
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
    ...overrides,
  };
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const result: unknown = await response.json().catch(() => null);
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof result.error === 'string'
  ) {
    return result.error;
  }
  return fallback;
}

function AddressForm({
  address,
  onCancel,
  onSaved,
}: {
  address?: AccountAddress;
  onCancel: () => void;
  onSaved: (saved: AccountAddress) => void;
}) {
  const [form, setForm] = useState<AddressFormState>(
    address
      ? {
          kind: address.kind === 'billing' ? 'billing' : 'shipping',
          firstName: address.firstName,
          lastName: address.lastName,
          company: address.company ?? '',
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2 ?? '',
          landmark: address.landmark ?? '',
          city: address.city,
          state: address.state ?? '',
          postalCode: address.postalCode,
          country: address.country,
          isDefaultShipping: address.isDefaultShipping,
          isDefaultBilling: address.isDefaultBilling,
        }
      : EMPTY_FORM,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch(
        address ? `/api/account/addresses/${address.id}` : '/api/account/addresses',
        {
          method: address ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Address could not be saved.'));
      }
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('address' in result) ||
        !result.address ||
        typeof result.address !== 'object'
      ) {
        throw new Error('Address was saved but the response could not be read.');
      }
      onSaved(result.address as AccountAddress);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Address could not be saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 border border-line bg-canvas p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-xl font-semibold">
          {address ? 'Edit address' : 'Add a new address'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary hover:text-ink-primary"
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="address-first-name" label="First name" value={form.firstName} onChange={(v) => update('firstName', v)} autoComplete="given-name" required />
        <TextField id="address-last-name" label="Last name" value={form.lastName} onChange={(v) => update('lastName', v)} autoComplete="family-name" required />
        <TextField id="address-company" label="Company (optional)" value={form.company} onChange={(v) => update('company', v)} autoComplete="organization" />
        <TextField id="address-phone" label="Phone" value={form.phone} onChange={(v) => update('phone', v)} autoComplete="tel" required type="tel" />
        <TextField id="address-line1" label="Street address" value={form.addressLine1} onChange={(v) => update('addressLine1', v)} autoComplete="address-line1" required />
        <TextField id="address-line2" label="Apartment, suite, etc. (optional)" value={form.addressLine2} onChange={(v) => update('addressLine2', v)} autoComplete="address-line2" />
        <TextField id="address-landmark" label="Landmark (optional)" value={form.landmark} onChange={(v) => update('landmark', v)} />
        <TextField id="address-city" label="City" value={form.city} onChange={(v) => update('city', v)} autoComplete="address-level2" required />
        <TextField id="address-state" label="State / region (optional)" value={form.state} onChange={(v) => update('state', v)} autoComplete="address-level1" />
        <TextField id="address-postal" label="Postal code" value={form.postalCode} onChange={(v) => update('postalCode', v)} autoComplete="postal-code" required />
        <TextField id="address-country" label="Country" value={form.country} onChange={(v) => update('country', v)} autoComplete="country-name" required />
        <div>
          <label htmlFor="address-kind" className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
            Address type
          </label>
          <select
            id="address-kind"
            value={form.kind}
            onChange={(event) => update('kind', event.target.value === 'billing' ? 'billing' : 'shipping')}
            className="mt-2 min-h-11 w-full border border-line bg-canvas px-3 text-sm"
          >
            <option value="shipping">Shipping</option>
            <option value="billing">Billing</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4 text-sm">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.isDefaultShipping}
            onChange={(event) => update('isDefaultShipping', event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Use as default shipping address
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.isDefaultBilling}
            onChange={(event) => update('isDefaultBilling', event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
          Use as default billing address
        </label>
      </div>

      {error && (
        <p role="alert" className="border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-brand">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? 'Saving…' : address ? 'Save changes' : 'Save address'}
      </button>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        maxLength={id === 'address-phone' ? 24 : 120}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full border border-line bg-canvas px-3 text-sm text-ink-primary"
      />
    </div>
  );
}

export function AddressManager({ initialAddresses }: { initialAddresses: AccountAddress[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editing, setEditing] = useState<AccountAddress | 'new' | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleSaved(saved: AccountAddress) {
    setAddresses((current) => {
      const exists = current.some((item) => item.id === saved.id);
      if (!exists) return [saved, ...current];
      return current.map((item) => (item.id === saved.id ? saved : item));
    });
    setEditing(null);
    setMessage('Address saved.');
    setError('');
    router.refresh();
  }

  async function setDefault(address: AccountAddress, field: 'shipping' | 'billing') {
    setPendingId(address.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/account/addresses/${address.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          addressToPayload(
            address,
            field === 'shipping'
              ? { isDefaultShipping: true }
              : { isDefaultBilling: true },
          ),
        ),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Default address could not be updated.'));
      }
      setAddresses((current) =>
        current.map((item) => {
          if (item.id === address.id) {
            return field === 'shipping'
              ? { ...item, isDefaultShipping: true }
              : { ...item, isDefaultBilling: true };
          }
          return field === 'shipping'
            ? { ...item, isDefaultShipping: false }
            : { ...item, isDefaultBilling: false };
        }),
      );
      setMessage(`${field === 'shipping' ? 'Shipping' : 'Billing'} default updated.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Default address could not be updated.');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(address: AccountAddress) {
    if (!window.confirm(`Delete the address for ${address.firstName} ${address.lastName}?`)) {
      return;
    }
    setPendingId(address.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/account/addresses/${address.id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Address could not be deleted.'));
      }
      setAddresses((current) => current.filter((item) => item.id !== address.id));
      setMessage('Address deleted. Order history keeps its original delivery snapshot.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Address could not be deleted.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-secondary">
          {addresses.length} saved {addresses.length === 1 ? 'address' : 'addresses'} · one default
          per category
        </p>
        {editing === null && (
          <button
            type="button"
            onClick={() => {
              setEditing('new');
              setMessage('');
              setError('');
            }}
            className="min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
          >
            Add address
          </button>
        )}
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

      {editing !== null && (
        <AddressForm
          address={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {addresses.length === 0 ? (
        <div className="border border-line bg-surface p-8 text-center">
          <p className="font-display text-xl font-semibold">No saved addresses</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">
            Add an address to make checkout faster. Order history always keeps the address
            snapshot that was used at the time of purchase.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-primary">
                    {address.firstName} {address.lastName}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                    {address.kind}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {address.isDefaultShipping && (
                    <span className="border border-cyan/40 bg-cyan/10 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-cyan">
                      Default shipping
                    </span>
                  )}
                  {address.isDefaultBilling && (
                    <span className="border border-cyan/40 bg-cyan/10 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-cyan">
                      Default billing
                    </span>
                  )}
                </div>
              </div>

              <address className="mt-4 text-sm not-italic leading-6 text-ink-secondary">
                {address.company && <span className="block">{address.company}</span>}
                <span className="block">{address.addressLine1}</span>
                {address.addressLine2 && <span className="block">{address.addressLine2}</span>}
                {address.landmark && <span className="block">{address.landmark}</span>}
                <span className="block">
                  {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </span>
                <span className="block">{address.country}</span>
                <span className="mt-2 block font-mono text-[10px] text-ink-muted">{address.phone}</span>
              </address>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(address)}
                  className="min-h-9 border border-line px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-secondary hover:border-brand hover:text-ink-primary"
                >
                  Edit
                </button>
                {!address.isDefaultShipping && (
                  <button
                    type="button"
                    disabled={pendingId === address.id}
                    onClick={() => void setDefault(address, 'shipping')}
                    className="min-h-9 border border-line px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-secondary hover:border-brand hover:text-ink-primary disabled:opacity-40"
                  >
                    Default shipping
                  </button>
                )}
                {!address.isDefaultBilling && (
                  <button
                    type="button"
                    disabled={pendingId === address.id}
                    onClick={() => void setDefault(address, 'billing')}
                    className="min-h-9 border border-line px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-secondary hover:border-brand hover:text-ink-primary disabled:opacity-40"
                  >
                    Default billing
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendingId === address.id}
                  onClick={() => void remove(address)}
                  className="min-h-9 border border-brand/40 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-brand hover:bg-brand/10 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
