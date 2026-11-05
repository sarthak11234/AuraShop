'use client';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="border border-brand/40 bg-surface p-8">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
        Account data unavailable
      </p>
      <h2 className="mt-3 font-display text-2xl font-semibold">Something went wrong.</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">
        The account data could not be loaded. You can retry the request. If the problem
        continues, sign out and sign in again.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-ink-muted">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-11 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-canvas transition-colors hover:bg-brand-hover"
      >
        Retry
      </button>
    </section>
  );
}
