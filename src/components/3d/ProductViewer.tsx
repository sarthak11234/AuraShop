'use client';

// ─────────────────────────────────────────────────────────────────────────
// ProductViewer — now renders the FashionViewer (virtual fashion model)
// instead of the procedural torus-knot artefact.
//
// The FashionViewer is a self-contained reusable component that handles:
//  • Male/Female avatar GLB loading
//  • Outfit GLB overlay
//  • OrbitControls (mouse + touch rotation, zoom)
//  • Missing-asset error states
//  • WebGL fallback
//  • Responsive canvas
//  • Resource disposal
// ─────────────────────────────────────────────────────────────────────────

import React from 'react';
import { FashionViewer } from './FashionViewer';
import type { Gender } from './FashionViewer';

export interface ProductViewerProps {
  /** Initial gender (default: 'male') */
  gender?: Gender;
  /** Outfit collection id (default: 'streetwear-001') */
  outfitId?: string;
}

export function ProductViewer({
  gender = 'male',
  outfitId = 'streetwear-001',
}: ProductViewerProps) {
  return (
    <FashionViewer
      gender={gender}
      outfitId={outfitId}
      showGenderToggle={true}
      autoRotate={true}
      heightClass="h-[70vh]"
    />
  );
}
