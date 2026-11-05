import { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState, formatDate } from '../_components';
import { InventoryAdjustmentForm } from './inventory-adjustment-form';

type SearchParams = Promise<{ q?: string; page?: string }>;

function getLowStockThreshold() {
  const value = Number.parseInt(process.env.LOW_STOCK_THRESHOLD ?? '5', 10);
  return Number.isInteger(value) && value >= 0 ? value : 5;
}

export default async function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? '';
  const rawPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const threshold = getLowStockThreshold();
  const where: Prisma.ProductVariantWhereInput = query
    ? {
        product: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
      }
    : {};
  const [variants, total] = await Promise.all([
    db.productVariant.findMany({
      where,
      orderBy: [{ product: { title: 'asc' } }, { size: 'asc' }],
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        size: true,
        sku: true,
        stock: true,
        updatedAt: true,
        product: { select: { title: true, slug: true } },
        adjustments: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            previousQuantity: true,
            newQuantity: true,
            difference: true,
            reason: true,
            createdAt: true,
            actor: { select: { name: true, email: true } },
          },
        },
      },
    }),
    db.productVariant.count({ where }),
  ]);
  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <AdminPageHeading
        eyebrow="Stock control"
        title="Inventory"
        description={`Stock is tracked by product variant. Low stock means ${threshold} units or fewer; change the LOW_STOCK_THRESHOLD environment setting to adjust.`}
      />
      <form action="/admin/inventory" className="mb-5 flex gap-3">
        <label htmlFor="inventory-search" className="sr-only">Search inventory</label>
        <input id="inventory-search" name="q" defaultValue={query} placeholder="Search products" className="min-h-11 min-w-0 flex-1 border border-line bg-surface px-3 text-sm" />
        <button className="min-h-11 border border-brand px-4 text-sm text-brand">Search</button>
      </form>

      {variants.length === 0 ? (
        <EmptyState>No variants match this search.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-line text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Product / variant</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Available</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium">Adjustment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {variants.map((variant) => (
                  <tr key={variant.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{variant.product.title}</p>
                      <p className="mt-1 text-xs text-ink-muted">{variant.size} · {variant.product.slug}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{variant.sku || '—'}</td>
                    <td className="px-4 py-3 font-mono">{variant.stock}</td>
                    <td className="px-4 py-3">
                      {variant.stock === 0 ? 'OUT OF STOCK' : variant.stock <= threshold ? 'LOW STOCK' : 'IN STOCK'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-secondary">{formatDate(variant.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <InventoryAdjustmentForm variantId={variant.id} currentStock={variant.stock} />
                      {variant.adjustments.length > 0 && (
                        <details className="mt-3 text-xs text-ink-muted">
                          <summary className="cursor-pointer">Recent adjustment history</summary>
                          <ul className="mt-2 space-y-2">
                            {variant.adjustments.map((entry, index) => (
                              <li key={`${entry.createdAt.toISOString()}-${index}`}>
                                {entry.previousQuantity} → {entry.newQuantity} ({entry.difference > 0 ? '+' : ''}{entry.difference}) · {entry.reason} · {formatDate(entry.createdAt)}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between text-sm text-ink-secondary">
            <span>{total} variants · page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
            <div className="flex gap-2">
              {page > 1 && <a className="border border-line px-3 py-2" href={`/admin/inventory?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</a>}
              {page < totalPages && <a className="border border-line px-3 py-2" href={`/admin/inventory?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</a>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
