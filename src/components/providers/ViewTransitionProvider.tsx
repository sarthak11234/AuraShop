'use client';

import { useLayoutEffect, type ReactNode } from 'react';

export function ViewTransitionProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    // Check if the browser supports View Transitions API
    if (!('startViewTransition' in document)) return;

    // This is a basic implementation. Ideally, we would hook into Next.js navigation events.
    // For App Router, we can intercept link clicks or use the experimental 'usePathname'
    // but a global intercept is more robust for 'morphing' effects.
  }, []);

  return <>{children}</>;
}
