import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { ProfileForm } from '@/components/account/ProfileForm';

export const instant = false;

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export default async function AccountProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to edit your profile"
        description="Profile details are scoped to your signed-in account."
      />
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      emailVerified: true,
      createdAt: true,
    },
  });

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Profile details</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          You can change your display name and delivery phone number. Account identifiers,
          roles and verification state cannot be edited from the storefront.
        </p>
        <div className="mt-6">
          <ProfileForm initialName={user.name ?? ''} initialPhone={user.phone ?? ''} />
        </div>
      </section>

      <aside className="space-y-4">
        <section className="border border-line bg-surface p-6">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-secondary">
            Sign-in identity
          </h2>
          <div className="mt-4 flex items-center gap-3">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? 'Account avatar'}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center border border-line bg-canvas font-display text-lg">
                {(user.name ?? user.email).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-primary">
                {user.name ?? 'VEXO member'}
              </p>
              <p className="truncate font-mono text-[10px] text-ink-muted">{user.email}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-secondary">Email</dt>
              <dd className="truncate text-right text-ink-primary">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-secondary">Email status</dt>
              <dd className="text-right text-ink-primary">
                {user.emailVerified ? 'Verified' : 'Managed by sign-in provider'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-secondary">Member since</dt>
              <dd className="text-right text-ink-primary">{dateFormatter.format(user.createdAt)}</dd>
            </div>
          </dl>

          <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink-muted">
            Email changes must be completed through Google, GitHub or the email magic-link
            provider so the new address is verified. They cannot be changed by this form.
          </p>
          <Link
            href="/account/settings"
            className="mt-4 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-brand"
          >
            View sign-in methods →
          </Link>
        </section>
      </aside>
    </div>
  );
}
