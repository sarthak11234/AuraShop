'use client';

import dynamic from 'next/dynamic';

// `ssr: false` is only allowed inside Client Components (Next 16 rule) —
// the WebGL/R3F canvas must never render on the server.
const ProductViewerLazy = dynamic(
  () => import('@/components/3d/ProductViewer').then((m) => m.ProductViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[70vh] my-4 border-t border-b border-black/10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-secondary border-t-transparent animate-spin" />
          <span className="monospace text-muted text-[11px] animate-pulse">
            INITIALISING_FASHION_VIEWER...
          </span>
        </div>
      </div>
    ),
  }
);

export function ProductViewerClient() {
  return <ProductViewerLazy />;
}
