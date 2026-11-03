'use client';

import React, { useRef, useEffect } from 'react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

interface RiveButtonProps {
  /** Label shown on the button */
  label: string;
  /** Optional Rive file path in /public, e.g. "/animations/button.riv" */
  riveSrc?: string;
  /** State machine name inside the Rive file */
  stateMachineName?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Visual variant */
  variant?: 'primary' | 'ghost' | 'icon';
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

/**
 * RiveButton — renders an interactive button with a Rive animation overlay.
 * Gracefully falls back to the CSS shimmer animation if no Rive file is provided
 * or if the @rive-app/react-canvas package is not installed yet.
 */
export function RiveButton({
  label,
  riveSrc,
  stateMachineName = 'ButtonSM',
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  id,
  children,
}: RiveButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  // ── Rive hook (only mounts if a src is provided) ─────────────────────
  const { rive, RiveComponent } = useRive(
    riveSrc
      ? {
          src: riveSrc,
          stateMachines: stateMachineName,
          autoplay: true,
          layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
        }
      : // Pass a minimal config that won't throw when src is absent
        { src: '', autoplay: false }
  );

  // Drive Rive state machine inputs on hover/press
  useEffect(() => {
    if (!rive) return;
    try {
      const inputs = rive.stateMachineInputs(stateMachineName);
      const hoverInput = inputs?.find((i) => i.name === 'isHover');
      const pressInput = inputs?.find((i) => i.name === 'isPressed');
      if (hoverInput) hoverInput.value = isHovered;
      if (pressInput) pressInput.value = isPressed;
    } catch {
      // Rive not loaded or inputs not found — silent no-op
    }
  }, [rive, isHovered, isPressed, stateMachineName]);

  // ── Variant styles ────────────────────────────────────────────────────
  const variantClasses = {
    primary:
      'relative inline-flex items-center gap-3 bg-brand text-ink-primary px-8 py-4 font-black italic tracking-tight text-sm uppercase overflow-hidden group hover:bg-brand-hover',
    ghost:
      'relative inline-flex items-center gap-2 border border-line text-ink-secondary px-6 py-3 font-bold italic text-sm uppercase overflow-hidden group hover:bg-surface hover:text-ink-primary transition-colors',
    icon:
      'relative inline-flex items-center justify-center w-11 h-11 rounded-full overflow-hidden group',
  };

  return (
    <button
      ref={buttonRef}
      id={id}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`${variantClasses[variant]} ${className} transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
      aria-label={label}
    >
      {/* Rive animation layer (absolute, pointer-events-none) */}
      {riveSrc && (
        <span className="absolute inset-0 pointer-events-none z-0">
          <RiveComponent />
        </span>
      )}

      {/* CSS fallback shimmer (always present, hidden when Rive is active) */}
      {!riveSrc && (
        <span
          className={`absolute inset-0 pointer-events-none z-0 transition-opacity duration-200 
            bg-gradient-to-r from-transparent via-white/20 to-transparent 
            -translate-x-full group-hover:translate-x-full 
            transition-transform duration-700 ease-out`}
        />
      )}

      {/* Pulse ring on primary */}
      {variant === 'primary' && (
        <span
          className={`absolute inset-0 ring-2 ring-brand ring-offset-0 pointer-events-none z-0 
            transition-opacity duration-150 ${isPressed ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Label + children */}
      <span className="relative z-10 flex items-center gap-2">
        {children ?? label}
        {variant === 'primary' && (
          <span className="translate-x-0 group-hover:translate-x-1 transition-transform duration-200">
            →
          </span>
        )}
      </span>
    </button>
  );
}
