import Image from 'next/image';
import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState, formatDate, formatMoney } from '../_components';
import { ProductLifecycleActions } from './product-editor';

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? '';
  const rawPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const where: Prisma.ProductWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { slug: { contains: query, mode: 'insensitive' } },
        ],
      }
    : {};
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        price: true,
        images: true,
        isPublished: true,
        archivedAt: true,
        createdAt: true,
        variants: { select: { stock: true } },
      },
    }),
    db.product.count({ where }),
  ]);
  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <AdminPageHeading
        eyebrow="Catalogue"
        title="Products"
        description="Create and maintain products. Product removal is archival to preserve historical order references."
        action={<Link href="/admin/products/new" className="min-h-11 bg-brand px-4 py-3 text-sm font-medium text-canvas">New product</Link>}
      />
      <form action="/admin/products" className="mb-5 flex gap-3">
        <label className="sr-only" htmlFor="product-search">Search products</label>
        <input id="product-search" name="q" defaultValue={query} placeholder="Search title or slug" className="min-h-11 min-w-0 flex-1 border border-line bg-surface px-3 text-sm" />
        <button className="min-h-11 border border-brand px-4 text-sm text-brand">Search</button>
      </form>

      {products.length === 0 ? (
        <EmptyState>No products match this search.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-line text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((product) => {
                  const image = Array.isArray(product.images)
                    ? product.images.find((value): value is string => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//'))
                    : undefined;
                  const stock = product.variants.reduce((totalStock, variant) => totalStock + variant.stock, 0);
                  const archived = product.archivedAt !== null;
                  return (
                    <tr key={product.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {image
                            ? <Image src={image} alt="" width={44} height={44} className="size-11 object-cover" />
                            : <span aria-hidden="true" className="flex size-11 items-center justify-center border border-line font-mono text-[9px] text-ink-muted">VEXO</span>}
                          <Link href={`/admin/products/${product.id}`} className="font-medium hover:text-brand">{product.title}</Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{product.slug}</td>
                      <td className="px-4 py-3">{product.category}</td>
                      <td className="px-4 py-3">{formatMoney(Number(product.price))}</td>
                      <td className="px-4 py-3">{stock}</td>
                      <td className="px-4 py-3">{archived ? 'Archived' : product.isPublished ? 'Published' : 'Unpublished'}</td>
                      <td className="px-4 py-3 text-ink-secondary">{formatDate(product.createdAt)}</td>
                      <td className="px-4 py-3">
                        <ProductLifecycleActions productId={product.id} isPublished={product.isPublished} archived={archived} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between text-sm text-ink-secondary">
            <span>{total} products · page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="border border-line px-3 py-2" href={`/admin/products?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</Link>}
              {page < totalPages && <Link className="border border-line px-3 py-2" href={`/admin/products?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</Link>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
