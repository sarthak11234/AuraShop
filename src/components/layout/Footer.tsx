import React from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────
// VEXO Footer — editorial multi-column footer.
// Navigation links point to real application routes.
// ─────────────────────────────────────────────────────────────────────────

const EXPLORE_LINKS = [
  { label: 'The VEXO Edit', href: '/' },
  { label: 'Collections', href: '/collections' },
  { label: 'Accessories', href: '/collections?category=ACCESSORY' },
  { label: 'Tech Lab', href: '/collections?category=TECH' },
  { label: 'Wishlist', href: '/wishlist' },
  { label: 'Cart', href: '/cart' },
];

export function Footer() {
  return (
    <footer className="w-full bg-canvas-secondary border-t border-line">
      <div className="max-w-[1800px] mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-8 pr-8">
            <div className="flex flex-col gap-4">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-black tracking-tight text-ink-primary">VEXO</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" />
              </Link>
              <p className="font-display text-sm uppercase tracking-widest text-brand">FUTURE IS WEARABLE.</p>
              <p className="text-sm text-ink-secondary leading-relaxed max-w-sm">
                VEXO is a fashion maison exploring technical materials, considered form and
                experimental streetwear.
              </p>
            </div>
            <div className="flex items-center gap-6">
              {/* Social destinations pending — intentionally omitted until real handles exist. */}
            </div>
          </div>

          {/* Explore column */}
          <nav aria-label="Explore VEXO" className="lg:col-span-3 flex flex-col gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted mb-2">EXPLORE //</span>
            <ul className="flex flex-col gap-2">
              {EXPLORE_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-secondary hover:text-ink-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            © 2026 VEXO MAISON INC. ALL RIGHTS RESERVED.
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            RELEASE 02.2026 // PARIS — TOKYO
          </span>
        </div>
      </div>
    </footer>
  );
}
