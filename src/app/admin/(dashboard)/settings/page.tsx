import { requireAdminPage } from '@/lib/admin';
import { AdminPageHeading, AdminPanel } from '../_components';

function getLowStockThreshold() {
  const value = Number.parseInt(process.env.LOW_STOCK_THRESHOLD ?? '5', 10);
  return Number.isInteger(value) && value >= 0 ? value : 5;
}

export default async function AdminSettingsPage() {
  const actor = await requireAdminPage();
  const threshold = getLowStockThreshold();

  return (
    <>
      <AdminPageHeading
        eyebrow="Configuration"
        title="Settings"
        description="Only supported, non-secret operational settings are shown here."
      />
      <div className="space-y-6">
        <AdminPanel title="Inventory">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Low-stock threshold</dt>
              <dd className="mt-1 text-lg">{threshold} units</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Configuration source</dt>
              <dd className="mt-1 font-mono text-sm">LOW_STOCK_THRESHOLD</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-secondary">
            This value is environment-configured and read-only in the dashboard. No runtime financial settings are available.
          </p>
        </AdminPanel>
        <AdminPanel title="Financial and store policies">
          <p className="text-sm leading-6 text-ink-secondary">
            The current data model does not persist store settings, currency configuration, shipping/tax rules, COD availability, or maintenance status.
            No setting is editable here, and existing checkout calculations are not changed by this dashboard.
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            Signed in as {actor.role.replace('_', ' ')}. Financial configuration and administrator-role management are not implemented.
          </p>
        </AdminPanel>
      </div>
    </>
  );
}
