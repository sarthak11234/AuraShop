'use client';

import React, { Suspense, useState, useCallback, useMemo, use, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls, ContactShadows, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import Image from 'next/image';
import { FashionModel } from './FashionModel';

// ─────────────────────────────────────────────────────────────────────────
// FashionViewer — hero-grade 3D fashion showcase for VEXO.
//
// • Male / Female avatar switching with asset-existence probing
// • Full-body framing (footwear visible) on a lit runway pedestal
// • Drag-to-rotate, wheel/pinch zoom, damped OrbitControls
// • Reset-camera glide back to the default framing
// • Gentle idle rotation, paused automatically while the user drags
// • Optional outfit-overlay architecture — outfit GLBs that do not exist
//   yet are probed first and silently skipped (never fabricated)
// • Loading / missing-asset / no-WebGL states (static reference image)
// • Lighting is a fully local Lightformer rig — no CDN fetches at runtime
// ─────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female';

export interface FashionViewerProps {
  gender?: Gender;
  outfitId?: string;
  showGenderToggle?: boolean;
  autoRotate?: boolean;
  heightClass?: string;
  onGenderChange?: (gender: Gender) => void;
}

// Front full-body framing (camera glides here for FRONT preset / reset).
const DEFAULT_CAMERA = {
  position: [0, 1.6, 4.85] as [number, number, number],
  target: [0, 1.4, 0] as [number, number, number],
};

// Editorial camera presets — smooth targets for the red-lit fashion stage.
const SIDE_CAMERA = {
  position: [4.6, 1.45, 0.8] as [number, number, number],
  target: [0, 1.3, 0] as [number, number, number],
};

const BACK_CAMERA = {
  position: [0, 1.6, -4.85] as [number, number, number],
  target: [0, 1.3, 0] as [number, number, number],
};

function avatarPath(gender: Gender): string {
  return `/models/avatars/${gender}-avatar.glb`;
}

function outfitPath(gender: Gender, outfitId: string): string {
  return `/models/outfits/${outfitId}/${gender}-outfit.glb`;
}

function referenceImage(gender: Gender): string {
  return `/models/reference/${gender}-model-ref.jpg`;
}

// ── Asset probe cache ────────────────────────────────────────────────────
const assetProbeCache = new Map<string, Promise<boolean>>();

function probeAsset(url: string): Promise<boolean> {
  const cached = assetProbeCache.get(url);
  if (cached) return cached;

  const promise = fetch(url, { method: 'HEAD' })
    .then((res) => res.ok)
    .catch(() => false);

  assetProbeCache.set(url, promise);
  return promise;
}

// ── WebGL Support Check ──────────────────────────────────────────────────
let _webglSupported: boolean | null = null;

export function isWebGLSupported(): boolean {
  if (_webglSupported !== null) return _webglSupported;
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    _webglSupported = !!gl;
  } catch {
    _webglSupported = false;
  }
  return _webglSupported;
}

// ── Camera Controller ────────────────────────────────────────────────────
// Eases the camera (and OrbitControls target) toward a camera preset with a
// damped lerp. Transitions are one-shot: while a glide runs the controls are
// disabled so a preset can never fight manual orbit; once landed, manual
// rotation resumes freely. `nonce` is the trigger (reset / preset button).
function CameraRig({
  preset,
  nonce,
  controlsRef,
}: {
  preset: { position: [number, number, number]; target: [number, number, number] };
  nonce: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const targetPos = useMemo(() => new THREE.Vector3(...preset.position), [preset]);
  const targetLook = useMemo(() => new THREE.Vector3(...preset.target), [preset]);
  const animatingRef = useRef(true);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animatingRef.current = true;
  }, [nonce]);

  useFrame(({ camera }) => {
    const controls = controlsRef.current;
    if (!controls || !animatingRef.current) return;

    // Snap instantly for users who prefer reduced motion.
    if (reducedMotionRef.current) {
      camera.position.copy(targetPos);
      controls.target.copy(targetLook);
      controls.update();
      animatingRef.current = false;
      controls.enabled = true;
      return;
    }

    camera.position.lerp(targetPos, 0.08);
    controls.target.lerp(targetLook, 0.08);
    controls.update();
    controls.enabled = false;

    if (camera.position.distanceTo(targetPos) < 0.02) {
      camera.position.copy(targetPos);
      controls.target.copy(targetLook);
      controls.update();
      animatingRef.current = false;
      controls.enabled = true;
    }
  });

  return null;
}

// ── Canvas Loading Fallback ──────────────────────────────────────────────
function CanvasLoader() {
  return (
    <group position={[0, 1.5, 0]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color="#FF454F" wireframe />
      </mesh>
    </group>
  );
}

// ── Missing Asset Overlay ────────────────────────────────────────────────
function AssetMissingOverlay({
  gender,
  missingFiles,
}: {
  gender: Gender;
  missingFiles: string[];
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#140304]/92 backdrop-blur-md p-6">
      <div className="max-w-md text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-2 border-brand flex items-center justify-center">
          <span className="text-brand text-2xl font-black">!</span>
        </div>
        <h3 className="monospace text-brand font-bold text-xs tracking-widest">
          ASSET_NOT_FOUND
        </h3>
        <p className="monospace text-ink-secondary text-[10px] leading-relaxed">
          The {gender} fashion model GLB is missing. Place the file in public/models/avatars/:
        </p>
        <div className="w-full bg-surface/80 border border-line p-3 text-left">
          {missingFiles.map((f) => (
            <code key={f} className="block monospace text-[10px] text-ink-primary font-bold">
              {f}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── No-WebGL Static Preview ──────────────────────────────────────────────
// Keeps the hero presentable (and the page fully usable) without WebGL.
function StaticPreview({ gender, heightClass }: { gender: Gender; heightClass: string }) {
  return (
    <section
      className={`relative w-full ${heightClass} overflow-hidden select-none bg-[#140304]`}
      aria-label="Fashion model preview"
    >
      <Image
        src={referenceImage(gender)}
        alt={`Static preview of the ${gender} model wearing the VEXO streetwear capsule`}
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#140304] via-transparent to-[#140304]/50 pointer-events-none" />
      <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 monospace text-[9px]">
        <span className="text-brand font-bold">WEBGL_NOT_AVAILABLE</span>
        <span className="text-ink-secondary">STATIC PREVIEW MODE</span>
      </div>
    </section>
  );
}

// ── Inner 3D Scene ───────────────────────────────────────────────────────
function FashionScene({
  gender,
  autoRotate,
  preset,
  nonce,
  currentAvatarPath,
  currentOutfitPath,
}: {
  gender: Gender;
  autoRotate: boolean;
  preset: { position: [number, number, number]; target: [number, number, number] };
  nonce: number;
  currentAvatarPath: string;
  currentOutfitPath: string;
}) {
  const avatarExists = use(probeAsset(currentAvatarPath));
  const outfitExists = use(probeAsset(currentOutfitPath));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  if (!avatarExists) {
    const missingFiles = [currentAvatarPath];
    if (!outfitExists) missingFiles.push(currentOutfitPath);
    return <AssetMissingOverlay gender={gender} missingFiles={missingFiles} />;
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: DEFAULT_CAMERA.position, fov: 45 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      aria-hidden="true"
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      <CameraRig preset={preset} nonce={nonce} controlsRef={controlsRef} />

      {/* ── Studio Lighting Rig (VEXO red-lit editorial) ────────────────── */}
      <ambientLight intensity={0.4} color="#3A0A0C" />

      {/* Key Light (Front-Left Crimson Key) */}
      <directionalLight
        position={[4, 6, 4]}
        intensity={2.1}
        color="#FF454F"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={3.5}
        shadow-camera-bottom={-0.5}
        shadow-bias={-0.0001}
      />

      {/* Fill Light (Front-Right Deep Red Soft Fill) */}
      <directionalLight position={[-4, 3, 2]} intensity={0.6} color="#6E1520" />

      {/* High-Angle Crimson Rim Light (Shoulder / Hood Contour Silhouette) */}
      <directionalLight position={[0, 4, -4]} intensity={2.2} color="#FF454F" />

      {/* Signature VEXO Cyber Red Rim Light (Bottom-Left Edge Accent) */}
      <directionalLight position={[-3, 1.2, -2]} intensity={1.5} color="#FF454F" />

      {/* Subtle Top Down Crimson Spotlight */}
      <spotLight
        position={[0, 5, 0]}
        intensity={0.6}
        angle={0.4}
        penumbra={1}
        color="#FF454F"
      />

      {/* Local Reflection Environment (Lightformers — no network fetch) */}
      <Environment resolution={64} frames={1} environmentIntensity={0.5}>
        <color attach="background" args={['#140304']} />
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#FF454F"
          position={[0, 4, 4]}
          scale={[7, 5, 1]}
          target={DEFAULT_CAMERA.target}
        />
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#E0454F"
          position={[-5, 3, -2]}
          scale={[6, 6, 1]}
          target={DEFAULT_CAMERA.target}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#FF6B6B"
          position={[5, 4, -3]}
          scale={[5, 6, 1]}
          target={DEFAULT_CAMERA.target}
        />
        <Lightformer
          form="circle"
          intensity={1.1}
          color="#FF454F"
          position={[-3, 1, -4]}
          scale={3}
          target={DEFAULT_CAMERA.target}
        />
      </Environment>

      {/* Soft Red-Tinted Contact Shadow on Floor */}
      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={0.5}
        scale={6}
        blur={2}
        far={3}
        color="#2A0508"
      />

      {/* Controls — damped orbit, zoom only, idle spin handled by the model */}
      <OrbitControls
        ref={controlsRef}
        enableZoom={true}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.06}
        autoRotate={false}
        minDistance={2.0}
        maxDistance={7.5}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.58}
        target={DEFAULT_CAMERA.target}
        makeDefault
        onStart={() => setIsInteracting(true)}
        onEnd={() => setIsInteracting(false)}
      />

      {/* 3D Model */}
      <Suspense fallback={<CanvasLoader />}>
        <FashionModel
          avatarPath={currentAvatarPath}
          outfitPath={outfitExists ? currentOutfitPath : undefined}
          autoRotate={autoRotate && !isInteracting}
          rotationSpeed={0.25}
        />
      </Suspense>
    </Canvas>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Main FashionViewer Component
// ═════════════════════════════════════════════════════════════════════════

const CONTROL_BTN =
  'px-2.5 py-1.5 border backdrop-blur-md transition-colors cursor-pointer';

// State classes are kept mutually exclusive (no overlapping bg/text-color
// utilities) so the cascade never resolves white-on-white.
function controlCls(active: boolean): string {
  return active
    ? `${CONTROL_BTN} border-brand bg-brand text-ink-primary font-bold`
    : `${CONTROL_BTN} border-line bg-surface/80 text-ink-secondary hover:text-ink-primary hover:border-brand`;
}

export function FashionViewer({
  gender: initialGender = 'male',
  outfitId = 'streetwear-001',
  showGenderToggle = true,
  autoRotate: initialAutoRotate = true,
  heightClass = 'h-[72vh]',
  onGenderChange,
}: FashionViewerProps) {
  const [gender, setGender] = useState<Gender>(initialGender);
  const [autoRotate, setAutoRotate] = useState<boolean>(initialAutoRotate);
  const [preset, setPreset] = useState(DEFAULT_CAMERA);
  const [presetNonce, setPresetNonce] = useState(0);
  const [activePreset, setActivePreset] = useState<'front' | 'side' | 'back'>('front');

  const webglSupported = isWebGLSupported();

  const currentAvatarPath = useMemo(() => avatarPath(gender), [gender]);
  const currentOutfitPath = useMemo(() => outfitPath(gender, outfitId), [gender, outfitId]);

  const handleGenderChange = useCallback(
    (g: Gender) => {
      assetProbeCache.delete(avatarPath(g));
      assetProbeCache.delete(outfitPath(g, outfitId));
      setGender(g);
      onGenderChange?.(g);
      // Re-aim at the current editorial preset after the avatar swap.
      setPresetNonce((n) => n + 1);
    },
    [onGenderChange, outfitId]
  );

  const handleReset = useCallback(() => {
    setPreset(DEFAULT_CAMERA);
    setActivePreset('front');
    setPresetNonce((n) => n + 1);
  }, []);

  const handlePreset = useCallback((key: 'front' | 'side' | 'back') => {
    const next = key === 'front' ? DEFAULT_CAMERA : key === 'side' ? SIDE_CAMERA : BACK_CAMERA;
    setPreset(next);
    setActivePreset(key);
    setPresetNonce((n) => n + 1);
  }, []);

  // Warm the idle avatar in the background so switching feels instant.
  useEffect(() => {
    const other = gender === 'male' ? 'female' : 'male';
    const timer = window.setTimeout(() => useGLTF.preload(avatarPath(other)), 1500);
    return () => window.clearTimeout(timer);
  }, [gender]);

  if (!webglSupported) {
    return <StaticPreview gender={gender} heightClass={heightClass} />;
  }

  return (
    <section
      id="fashion-viewer"
      className={`relative w-full ${heightClass} overflow-hidden select-none`}
      aria-label="3D fashion model showcase"
    >
      {/* ── Red-Illuminated Studio Atmosphere ─────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(255,69,79,0.16)_0%,_rgba(12,2,4,0)_70%)]" />

      {/* ── Micro-Label: Live Status (Top-Left) ────────────────────────── */}
      <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-10 flex items-center gap-2 monospace text-[9px] text-ink-secondary pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
        <span className="text-brand font-bold tracking-widest">3D_SHOWCASE.LIVE</span>
      </div>

      {/* ── Micro-Label: Avatar Identity (Top-Right) ───────────────────── */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10 flex flex-col items-end gap-0.5 monospace text-[9px] text-ink-muted text-right pointer-events-none">
        <span className="text-ink-primary font-bold">VEXO // NEURAL SERIES</span>
        <span>AVATAR: {gender === 'male' ? 'MALE_01' : 'FEMALE_01'}</span>
      </div>

      {/* ── Corner Framing Brackets ────────────────────────────────────── */}
      <div className="absolute inset-4 sm:inset-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-7 h-7 border-t border-l border-line" />
        <div className="absolute top-0 right-0 w-7 h-7 border-t border-r border-line" />
        <div className="absolute bottom-0 left-0 w-7 h-7 border-b border-l border-line" />
        <div className="absolute bottom-0 right-0 w-7 h-7 border-b border-r border-line" />
      </div>

      {/* ── Controls: Reset / Presets / Idle / Gender (Bottom-Right) ─────── */}
      <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-20 flex items-center gap-1.5 monospace text-[9px]">
        <button
          onClick={handleReset}
          className={`${CONTROL_BTN} border-line bg-surface/80 text-ink-secondary hover:text-ink-primary hover:border-brand`}
          title="Reset camera to the full-body framing"
          aria-label="Reset camera to full-body framing"
        >
          ↺ RESET
        </button>

        <button
          onClick={() => handlePreset('front')}
          className={controlCls(activePreset === 'front')}
          aria-pressed={activePreset === 'front'}
          title="Front camera preset"
          aria-label="Front camera preset"
        >
          FRONT
        </button>

        <button
          onClick={() => handlePreset('side')}
          className={controlCls(activePreset === 'side')}
          aria-pressed={activePreset === 'side'}
          title="Side camera preset"
          aria-label="Side camera preset"
        >
          SIDE
        </button>

        <button
          onClick={() => handlePreset('back')}
          className={controlCls(activePreset === 'back')}
          aria-pressed={activePreset === 'back'}
          title="Back camera preset"
          aria-label="Back camera preset"
        >
          BACK
        </button>

        <button
          onClick={() => setAutoRotate((prev) => !prev)}
          className={controlCls(autoRotate)}
          aria-pressed={autoRotate}
          title="Toggle idle rotation"
        >
          {autoRotate ? '■ IDLE: ON' : '▶ IDLE: OFF'}
        </button>

        {showGenderToggle && (
          <div className="flex">
            <button
              onClick={() => handleGenderChange('male')}
              className={`${controlCls(gender === 'male')} border-r-0`}
              aria-label="Switch to Male Model"
              aria-pressed={gender === 'male'}
            >
              MALE
            </button>
            <button
              onClick={() => handleGenderChange('female')}
              className={controlCls(gender === 'female')}
              aria-label="Switch to Female Model"
              aria-pressed={gender === 'female'}
            >
              FEMALE
            </button>
          </div>
        )}
      </div>

      {/* ── 3D Scene ───────────────────────────────────────────────────── */}
      <Suspense
        fallback={
          <div className="absolute inset-0 z-[15] flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-brand border-t-transparent animate-spin" />
              <span className="monospace text-ink-secondary text-[11px] animate-pulse">
                LOADING_3D_AVATAR...
              </span>
            </div>
          </div>
        }
      >
        <FashionScene
          gender={gender}
          autoRotate={autoRotate}
          preset={preset}
          nonce={presetNonce}
          currentAvatarPath={currentAvatarPath}
          currentOutfitPath={currentOutfitPath}
        />
      </Suspense>
    </section>
  );
}
