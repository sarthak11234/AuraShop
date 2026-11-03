'use client';

import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────────────────────────────────
// Model loader utilities for the FashionViewer system.
// ─────────────────────────────────────────────────────────────────────────

export type ModelStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ModelLoaderResult {
  gltf: GLTF | null;
  status: ModelStatus;
  error: string | null;
  retry: () => void;
}

/**
 * Thin Suspense-compatible wrapper around useGLTF.
 * Only called when we've already confirmed the file exists.
 */
export function useValidatedGLTF(path: string): GLTF {
  return useGLTF(path) as unknown as GLTF;
}
