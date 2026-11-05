import { AccountSignInButton } from './AccountSignInButton';

export function AccountSignInPrompt({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="border border-line bg-surface p-8">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
        Authentication required
      </p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink-primary">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">{description}</p>
      <AccountSignInButton />
    </section>
  );
}
