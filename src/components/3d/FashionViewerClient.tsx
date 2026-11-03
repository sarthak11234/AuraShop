'use client';

import dynamic from 'next/dynamic';
import type { FashionViewerProps } from './FashionViewer';

// `ssr: false` is only allowed inside Client Components (Next 16 rule) —
// the WebGL/R3F canvas must never render on the server. The 3D bundle
// (three + drei + avatar GLBs) is code-split out of the initial chunk and
// only fetched by the browser.
const FashionViewerLazy = dynamic(
  () => import('@/components/3d/FashionViewer').then((m) => m.FashionViewer),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-brand border-t-transparent animate-spin" />
          <span className="monospace text-ink-secondary text-[11px] animate-pulse">
            LOADING_3D_AVATAR...
          </span>
        </div>
      </div>
    ),
  }
);

export function FashionViewerClient(props: FashionViewerProps) {
  return <FashionViewerLazy {...props} />;
}
