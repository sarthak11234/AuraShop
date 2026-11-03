import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pb-24 pt-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-ink-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-ink-primary) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="relative w-full max-w-2xl border border-line bg-surface p-8 sm:p-12">
        <div className="flex items-center justify-between border-b border-line pb-4 font-mono text-[9px] tracking-widest text-ink-muted">
          <span>ERROR.404</span>
          <span className="text-brand">ROUTE_NOT_FOUND</span>
        </div>

        <p className="mt-10 font-mono text-[10px] font-bold tracking-[0.3em] text-brand">
          SIGNAL LOST
        </p>
        <h1 className="mt-4 break-words font-display text-6xl font-black italic leading-[0.85] tracking-tighter text-ink-primary sm:text-8xl">
          404
        </h1>
        <p className="mt-4 font-display text-2xl font-bold tracking-tight text-ink-primary">
          This page does not exist.
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
          The requested unit is not part of the current VEXO release. Check the
          address or return to the catalogue to continue exploring.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/collections"
            className="flex min-h-12 items-center justify-center border border-brand bg-brand px-6 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-primary transition-colors hover:bg-brand-hover sm:flex-1"
          >
            ← Back to catalogue
          </Link>
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center border border-line px-6 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary transition-colors hover:border-brand hover:text-brand sm:flex-1"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
