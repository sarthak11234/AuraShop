import { auth } from '@/auth';
import { AccountSignInPrompt } from '@/components/account/AccountSignInPrompt';
import { WishlistContent } from '@/components/product/WishlistContent';

export const instant = false;

export default async function AccountWishlistPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <AccountSignInPrompt
        title="Sign in to open your account wishlist"
        description="The saved wishlist is scoped to the signed-in customer on this browser."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Saved pieces</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
          Your wishlist is stored in this browser and kept separate for each signed-in
          customer. Availability is refreshed from the live catalogue, but products are never
          removed automatically.
        </p>
      </section>
      <WishlistContent embedded />
    </div>
  );
}
