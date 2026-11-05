import { auth } from '@/auth';
import { db } from '@/lib/db';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';

export const instant = false;

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  resend: 'Email magic link',
};

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export default async function AccountSettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to view account settings"
        description="Authentication methods and account controls are only available to the signed-in account."
      />
    );
  }

  const [user, linkedAccounts] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, createdAt: true },
    }),
    db.account.findMany({
      where: { userId },
      select: { provider: true },
      orderBy: { provider: 'asc' },
    }),
  ]);

  if (!user) {
    return (
      <section className="border border-line bg-surface p-8">
        <h2 className="font-display text-2xl font-semibold">Account unavailable</h2>
        <p className="mt-3 text-sm text-ink-secondary">
          The account record for this session no longer exists.
        </p>
      </section>
    );
  }

  const providerNames = Array.from(
    new Set(linkedAccounts.map((account) => PROVIDER_LABELS[account.provider] ?? account.provider)),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
      <div className="space-y-6">
        <section className="border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Sign-in and security</h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            VEXO uses trusted sign-in providers and passwordless email links. Passwords are
            never stored by this storefront, so a password change is not available.
          </p>

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-3">
              <dt className="text-ink-secondary">Email identity</dt>
              <dd className="text-ink-primary">{user.email}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-3">
              <dt className="text-ink-secondary">Email verification</dt>
              <dd className="text-ink-primary">
                {user.emailVerified ? 'Verified' : 'Verification handled by provider'}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-3">
              <dt className="text-ink-secondary">Linked sign-in providers</dt>
              <dd className="text-right text-ink-primary">
                {providerNames.length > 0 ? providerNames.join(' · ') : 'Email magic link'}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-ink-secondary">Account created</dt>
              <dd className="text-ink-primary">{dateFormatter.format(user.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-6 border border-line bg-canvas p-4">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-secondary">
              Password management
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              Not available. Accounts sign in through Google, GitHub or a verified email
              magic link. If you need help regaining access, contact support using the email
              address on this account.
            </p>
          </div>
        </section>

        <section className="border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Data and account closure</h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            In-app account deletion is intentionally unavailable. Deleting an account would
            orphan order, payment and audit records that must be retained for customer support
            and accounting. Contact support if you need help with a data request or account
            closure.
          </p>
          <a
            href="mailto:support@vexo.store"
            className="mt-5 inline-flex min-h-11 items-center border border-line px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
          >
            Email support
          </a>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="border border-line bg-surface p-6">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
            Supported capabilities
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-secondary">
            <li>Edit display name and delivery phone · available</li>
            <li>Manage saved shipping and billing addresses · available</li>
            <li>View owned order history and tracking · available</li>
            <li>Cancel eligible pre-shipment orders · available</li>
            <li>Change email · through sign-in provider verification only</li>
            <li>Create or change a password · not supported</li>
            <li>Delete account and order records in-app · not supported</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
