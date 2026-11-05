import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, EmptyState, formatDate, formatMoney } from '../_components';

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function AdminCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? '';
  const rawPage = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) ? Math.min(100_000, Math.max(1, rawPage)) : 1;
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [customers, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  const totals = customers.length
    ? await db.order.groupBy({
        by: ['userId'],
        where: {
          userId: { in: customers.map(({ id }) => id) },
          status: { notIn: ['CANCELLED', 'RETURNED'] },
        },
        _sum: { total: true },
      })
    : [];
  const orderTotals = new Map(totals.map(({ userId, _sum }) => [userId, Number(_sum.total ?? 0)]));
  const totalPages = Math.ceil(total / 25);

  return (
    <>
      <AdminPageHeading
        eyebrow="Accounts"
        title="Customers"
        description="Customer profile and order data only. Passwords, linked identity tokens, and authentication secrets are never selected."
      />
      <form action="/admin/customers" className="mb-5 flex gap-3">
        <label htmlFor="customer-search" className="sr-only">Search customers</label>
        <input id="customer-search" name="q" defaultValue={query} placeholder="Name or email" className="min-h-11 min-w-0 flex-1 border border-line bg-surface px-3 text-sm" />
        <button className="min-h-11 border border-brand px-4 text-sm text-brand">Search</button>
      </form>
      <p className="mb-4 border border-line bg-surface p-3 text-xs text-ink-muted">
        Order value excludes cancelled and returned orders, but cannot be treated as customer spending because payment collection is not modeled.
      </p>
      {customers.length === 0 ? (
        <EmptyState>No customers match this search.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[740px] text-left text-sm">
              <thead className="border-b border-line text-[10px] uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Gross order value</th>
                  <th className="px-4 py-3 font-medium">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3">{customer.name || '—'}</td>
                    <td className="px-4 py-3">{customer.email}</td>
                    <td className="px-4 py-3 text-ink-secondary">{formatDate(customer.createdAt)}</td>
                    <td className="px-4 py-3">{customer._count.orders}</td>
                    <td className="px-4 py-3">{formatMoney(orderTotals.get(customer.id) ?? 0)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${customer.id}`} className="text-brand hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-between text-sm text-ink-secondary">
            <span>{total} customers · page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="border border-line px-3 py-2" href={`/admin/customers?q=${encodeURIComponent(query)}&page=${page - 1}`}>Previous</Link>}
              {page < totalPages && <Link className="border border-line px-3 py-2" href={`/admin/customers?q=${encodeURIComponent(query)}&page=${page + 1}`}>Next</Link>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
