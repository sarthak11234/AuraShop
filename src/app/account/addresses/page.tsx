import { auth } from '@/auth';
import { getSavedAddresses, serializeSavedAddress } from '@/lib/account-addresses';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { AddressManager } from '@/components/account/AddressManager';

export const instant = false;

export default async function AccountAddressesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to manage addresses"
        description="Saved addresses are kept private to your account and can only be changed while signed in."
      />
    );
  }

  const addresses = await getSavedAddresses(userId);

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Saved addresses</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
          Set one default shipping and billing address. Editing or deleting a saved address
          never changes the address snapshot stored with an existing order.
        </p>
      </section>

      <AddressManager initialAddresses={addresses.map(serializeSavedAddress)} />
    </div>
  );
}
