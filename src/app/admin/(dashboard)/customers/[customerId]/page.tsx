import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin';
import { db } from '@/lib/db';
import { AdminPageHeading, AdminPanel, EmptyState, formatDate, formatMoney } from '../../_components';

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  await requireAdminPage();
  const { customerId } = await params;
  const customer = await db.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, status: true, total: true, createdAt: true },
      },
    },
  });
  if (!customer) notFound();

  const grossOrderValue = customer.orders
    .filter((order) => order.status !== 'CANCELLED' && order.status !== 'RETURNED')
    .reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <>
      <AdminPageHeading
        eyebrow="Accounts / customers"
        title={customer.name || 'Customer'}
        description={customer.email}
        action={<Link href="/admin/customers" className="border border-line px-4 py-3 text-sm">Back to customers</Link>}
      />
      <div className="mb-6 grid gap-px border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface p-4"><p className="text-xs text-ink-muted">Registered</p><p className="mt-2 text-sm">{formatDate(customer.createdAt)}</p></div>
        <div className="bg-surface p-4"><p className="text-xs text-ink-muted">Recent orders shown</p><p className="mt-2 text-2xl">{customer.orders.length}</p></div>
        <div className="bg-surface p-4"><p className="text-xs text-ink-muted">Gross order value (recent 20)</p><p className="mt-2 text-2xl">{formatMoney(grossOrderValue)}</p></div>
      </div>
      <p className="mb-6 border border-line bg-surface p-3 text-sm text-ink-secondary">
        This value is not verified spending. Payment status, phone, saved addresses, and customer account disabling are not supported by the current data model.
      </p>
      <AdminPanel title="Recent order history">
        {customer.orders.length === 0 ? (
          <EmptyState>This customer has no orders.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Order</th>
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Order total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customer.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 pr-4">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-brand hover:underline">
                        #{order.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-ink-secondary">{formatDate(order.createdAt)}</td>
                    <td className="py-3 pr-4">{order.status.replaceAll('_', ' ')}</td>
                    <td className="py-3">{formatMoney(Number(order.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>
    </>
  );
}
