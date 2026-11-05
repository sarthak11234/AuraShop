import { requireAdminPage } from '@/lib/admin';
import { AdminPageHeading, AdminPanel } from '../_components';

export default async function AdminPaymentsPage() {
  await requireAdminPage();
  return (
    <>
      <AdminPageHeading
        eyebrow="Finance"
        title="Payments"
        description="Payment review and refunds are unavailable until transactions are persisted."
      />
      <AdminPanel title="Payment records unavailable">
        <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
          The current database has no payment, refund, provider transaction, collection-status, or idempotency records.
          The admin UI intentionally does not infer a payment from an order total or mark COD orders as paid. Refund
          initiation is not implemented because no persisted payment references or gateway verification flow are
          available to authorize a safe refund.
        </p>
      </AdminPanel>
    </>
  );
}
