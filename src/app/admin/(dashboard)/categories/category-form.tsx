'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  productCount: number;
};

const fieldClass = 'mt-1 min-h-10 w-full border border-line bg-canvas px-3 text-sm';

export function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setPending(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch(
        category ? `/api/admin/categories/${encodeURIComponent(category.id)}` : '/api/admin/categories',
        {
          method: category ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.get('name'),
            slug: formData.get('slug'),
            description: formData.get('description'),
            isPublished: formData.get('isPublished') === 'on',
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Category could not be saved');
      router.refresh();
      if (!category) form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Category could not be saved');
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!category) return;
    const reason = window.prompt('Reason for deleting this category (at least 8 characters):');
    if (!reason || reason.trim().length < 8) return;
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(category.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Category could not be deleted');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Category could not be deleted');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-line bg-surface p-4">
      {category && (
        <p className="mb-3 text-xs text-ink-muted">{category.productCount} linked product{category.productCount === 1 ? '' : 's'}</p>
      )}
      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs">Name
          <input className={fieldClass} name="name" defaultValue={category?.name} required minLength={2} maxLength={80} />
        </label>
        <label className="block text-xs">Category code
          <input className={fieldClass} name="slug" defaultValue={category?.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
        </label>
        <label className="block text-xs">Description
          <textarea className={fieldClass} name="description" rows={3} defaultValue={category?.description ?? ''} maxLength={1000} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={category?.isPublished ?? true} />
          Published
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="min-h-10 bg-brand px-3 text-xs font-medium text-canvas disabled:opacity-50">
            {pending ? 'Saving…' : category ? 'Save category' : 'Create category'}
          </button>
          {category && (
            <button type="button" onClick={remove} disabled={pending || category.productCount > 0} title={category.productCount > 0 ? 'Reassign associated products first' : undefined} className="min-h-10 border border-line px-3 text-xs disabled:opacity-50">
              Delete
            </button>
          )}
        </div>
        {message && <p role="alert" className="text-sm text-brand">{message}</p>}
      </form>
    </div>
  );
}
