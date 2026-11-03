'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────
// FashionModel — loads, normalises, lights, and enhances the 3D GLB avatar.
// Includes a minimalist cyber runway pedestal and PBR material enhancements.
// ─────────────────────────────────────────────────────────────────────────

export interface FashionModelProps {
  /** Path to the base avatar GLB (e.g. /models/avatars/male-avatar.glb) */
  avatarPath: string;
  /** Optional path to an outfit overlay GLB */
  outfitPath?: string;
  /** Enable gentle auto-rotation */
  autoRotate?: boolean;
  /** Rotation speed in radians/second */
  rotationSpeed?: number;
  /** Whether to render in cyber wireframe mode */
  wireframe?: boolean;
}

/**
 * Normalise a GLTF scene into a box of `targetHeight` units, centred at origin,
 * with shoes anchored cleanly at y = 0. Enhances PBR materials so AI-generated
 * flat diffuse textures catch realistic studio lighting and reflections.
 */
function normaliseAndEnhanceScene(
  scene: THREE.Object3D,
  targetHeight = 3.2,
  wireframe = false
): THREE.Object3D {
  const clone = scene.clone(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? targetHeight / maxDim : 1;
  clone.scale.setScalar(scale);

  // Re-centre horizontally after scaling
  const scaledBox = new THREE.Box3().setFromObject(clone);
  const scaledCentre = scaledBox.getCenter(new THREE.Vector3());
  clone.position.sub(scaledCentre);

  // Anchor feet to y = 0.01 (resting just above the pedestal)
  const scaledSize = scaledBox.getSize(new THREE.Vector3());
  clone.position.y += scaledSize.y / 2 + 0.02;

  // Material and shadow enhancements
  clone.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.roughness = wireframe ? 0.2 : 0.72;
            mat.metalness = wireframe ? 0.9 : 0.06;
            mat.envMapIntensity = 1.0;
            mat.wireframe = wireframe;
            if (wireframe) {
              mat.color = new THREE.Color('#EB3333');
            }
            mat.needsUpdate = true;
          }
        });
      }
    }
  });

  return clone;
}

/** Minimalist futuristic runway platform under the model */
function RunwayPedestal() {
  return (
    <group position={[0, 0, 0]}>
      {/* Main dark circular turntable base */}
      <mesh position={[0, -0.015, 0]} receiveShadow>
        <cylinderGeometry args={[1.35, 1.4, 0.03, 64]} />
        <meshStandardMaterial
          color="#14171a"
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* Outer VEXO red accent glowing ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[1.38, 1.41, 64]} />
        <meshBasicMaterial color="#EB3333" transparent opacity={0.7} />
      </mesh>

      {/* Subtle inner concentric coordinate ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[1.15, 1.155, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>

      {/* 4 Cardinal tick marks */}
      {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, angle]}
          position={[Math.cos(angle) * 1.25, 0.003, Math.sin(angle) * 1.25]}
        >
          <planeGeometry args={[0.08, 0.004]} />
          <meshBasicMaterial color="#EB3333" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Subcomponent to load optional outfit overlays without breaking React Hook rules */
function OutfitMesh({ path, wireframe }: { path: string; wireframe: boolean }) {
  const gltf = useGLTF(path);
  const scene = useMemo(
    () => normaliseAndEnhanceScene(gltf.scene, 3.2, wireframe),
    [gltf.scene, wireframe]
  );

  useEffect(() => {
    return () => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    };
  }, [scene]);

  return <primitive object={scene} />;
}

export function FashionModel({
  avatarPath,
  outfitPath,
  autoRotate = true,
  rotationSpeed = 0.25,
  wireframe = false,
}: FashionModelProps) {
  const groupRef = useRef<THREE.Group>(null!);

  // Load the avatar (Suspense-compatible)
  const avatarGltf = useGLTF(avatarPath);

  // Normalise and memoise scene with PBR material tuning
  const avatarScene = useMemo(
    () => normaliseAndEnhanceScene(avatarGltf.scene, 3.2, wireframe),
    [avatarGltf.scene, wireframe]
  );

  // Detect prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Subtle auto-rotation around the model's central axis
  useFrame(({ clock }) => {
    if (!groupRef.current || !autoRotate || prefersReducedMotion) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * rotationSpeed;
  });

  // Dispose cloned scenes on unmount to free GPU memory
  useEffect(() => {
    return () => {
      avatarScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    };
  }, [avatarScene]);

  return (
    <group ref={groupRef}>
      <RunwayPedestal />
      <primitive object={avatarScene} />
      {outfitPath && <OutfitMesh path={outfitPath} wireframe={wireframe} />}
    </group>
  );
}
