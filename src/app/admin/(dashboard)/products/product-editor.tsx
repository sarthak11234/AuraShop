'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type CategoryOption = { id: string; name: string };
type ProductInitial = {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  categoryId: string | null;
  description: string;
  details: string[];
  images: unknown;
  price: number;
  version: string;
  isNew: boolean;
  isPublished: boolean;
  variants: { size: string }[];
};

const fieldClass = 'mt-1 min-h-11 w-full border border-line bg-canvas px-3 py-2 text-sm';

export function ProductEditor({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: ProductInitial;
}) {
  const router = useRouter();
  const initialImages = Array.isArray(initial?.images)
    ? initial.images.filter((value): value is string => typeof value === 'string').join('\n')
    : '';
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const body = {
      title: formData.get('title'),
      slug: formData.get('slug'),
      subtitle: formData.get('subtitle'),
      categoryId: formData.get('categoryId'),
      description: formData.get('description'),
      details: String(formData.get('details') ?? '').split('\n').map((item) => item.trim()).filter(Boolean),
      images: String(formData.get('images') ?? '').split('\n').map((item) => item.trim()).filter(Boolean),
      sizes: String(formData.get('sizes') ?? '').split('\n').map((item) => item.trim()).filter(Boolean),
      price: Number(formData.get('price')),
      version: formData.get('version'),
      isNew: formData.get('isNew') === 'on',
      isPublished: formData.get('isPublished') === 'on',
    };

    try {
      const response = await fetch(
        initial ? `/api/admin/products/${encodeURIComponent(initial.id)}` : '/api/admin/products',
        {
          method: initial ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Product could not be saved');
      router.push('/admin/products');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Product could not be saved');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      {categories.length === 0 && (
        <p className="border border-brand/40 p-3 text-sm text-brand">
          Create a category before adding products.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Product title
          <input className={fieldClass} name="title" defaultValue={initial?.title} required minLength={2} maxLength={160} />
        </label>
        <label className="text-sm">Slug
          <input className={fieldClass} name="slug" defaultValue={initial?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} />
        </label>
        <label className="text-sm">Subtitle
          <input className={fieldClass} name="subtitle" defaultValue={initial?.subtitle} maxLength={240} />
        </label>
        <label className="text-sm">Category
          <select className={fieldClass} name="categoryId" defaultValue={initial?.categoryId ?? ''} required>
            <option value="" disabled>Select category</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Price (USD)
          <input className={fieldClass} name="price" type="number" step="0.01" min="0.01" max="10000000" defaultValue={initial?.price} required />
        </label>
        <label className="text-sm">Version
          <input className={fieldClass} name="version" defaultValue={initial?.version ?? '01'} maxLength={60} />
        </label>
      </div>
      <label className="block text-sm">Description
        <textarea className={fieldClass} name="description" rows={5} defaultValue={initial?.description} required maxLength={10000} />
      </label>
      <label className="block text-sm">Product details (one per line)
        <textarea className={fieldClass} name="details" rows={4} defaultValue={initial?.details.join('\n')} />
      </label>
      <label className="block text-sm">Image URLs or hex color swatches (one per line)
        <textarea className={fieldClass} name="images" rows={4} defaultValue={initialImages} required />
      </label>
      <label className="block text-sm">Variant sizes (one per line)
        <textarea className={fieldClass} name="sizes" rows={3} defaultValue={initial?.variants.map(({ size }) => size).join('\n')} />
        {initial && <span className="mt-1 block text-xs text-ink-muted">Existing variants are retained; add sizes here to create zero-stock variants. Adjust stock under Inventory.</span>}
      </label>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isNew" defaultChecked={initial?.isNew} /> Featured / new</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={initial?.isPublished} /> Published</label>
      </div>
      {message && <p role="alert" className="text-sm text-brand">{message}</p>}
      <button
        type="submit"
        disabled={pending || categories.length === 0}
        className="min-h-11 bg-brand px-5 text-sm font-medium text-canvas disabled:opacity-50"
      >
        {pending ? 'Saving…' : initial ? 'Save product' : 'Create product'}
      </button>
    </form>
  );
}

export function ProductLifecycleActions({
  productId,
  isPublished,
  archived,
}: {
  productId: string;
  isPublished: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const action = archived ? 'publish' : isPublished ? 'unpublish' : 'archive';
  const label = action === 'publish' ? 'Restore & publish' : action === 'archive' ? 'Archive' : 'Unpublish';

  async function run() {
    const reason = window.prompt(`Reason for ${action}ing this product (at least 8 characters):`);
    if (!reason || reason.trim().length < 8) return;
    if (!window.confirm(`${label} this product?`)) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Product action failed');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Product action failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={run} disabled={pending} className="border border-line px-3 py-2 text-xs hover:border-brand disabled:opacity-50">
        {pending ? 'Working…' : label}
      </button>
      {message && <p role="alert" className="mt-2 text-xs text-brand">{message}</p>}
    </div>
  );
}
