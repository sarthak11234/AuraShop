'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useOverlayBehavior } from '@/hooks/useOverlayBehavior';

interface ImageGalleryProps {
  /** Array of colour strings or image URLs */
  images: string[];
  productTitle: string;
  productSlug: string;
}

function isUrl(str: string): boolean {
  return str.startsWith('http') || str.startsWith('/');
}

function ImageFallback({
  color,
  title,
  unavailable = false,
}: {
  color?: string;
  title: string;
  unavailable?: boolean;
}) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ backgroundColor: unavailable ? '#18181C' : color ?? '#1a1a1a' }}
    >
      <div className="absolute inset-8 pointer-events-none">
        <div className="absolute top-0 left-0 h-6 w-6 border-t border-l border-brand/60" />
        <div className="absolute top-0 right-0 h-6 w-6 border-t border-r border-brand/60" />
        <div className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-brand/60" />
        <div className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-brand/60" />
      </div>

      <div className="flex flex-col items-center gap-3 px-6 text-center opacity-70">
        <div className="h-[1px] w-16 bg-line" />
        <span className="monospace text-[11px] text-ink-primary">{title}</span>
        {unavailable && (
          <span className="monospace text-[9px] text-brand">IMAGE_UNAVAILABLE</span>
        )}
        <div className="h-[1px] w-16 bg-line" />
      </div>

      <div className="scanlines pointer-events-none absolute inset-0 opacity-20" />
    </div>
  );
}

export function ImageGallery({ images, productTitle, productSlug }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const active = images[activeIndex] ?? '#1a1a1a';
  const lastIndex = images.length - 1;
  const activeIsUrl = isUrl(active) && !failedImages[activeIndex];

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setIsZoomed(false);
  };

  const { closeRef, dialogRef } = useOverlayBehavior<HTMLDivElement>(
    isFullscreen,
    closeFullscreen,
  );

  function showPrevious() {
    setActiveIndex((index) => Math.max(0, index - 1));
    setIsZoomed(false);
  }

  function showNext() {
    setActiveIndex((index) => Math.min(lastIndex, index + 1));
    setIsZoomed(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft' && activeIndex > 0) {
      event.preventDefault();
      showPrevious();
    } else if (event.key === 'ArrowRight' && activeIndex < lastIndex) {
      event.preventDefault();
      showNext();
    }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const startX = touchStartX.current;
    touchStartX.current = null;
    const endX = event.changedTouches[0]?.clientX;
    if (startX === null || endX === undefined) return;

    const distance = endX - startX;
    if (Math.abs(distance) < 40) return;
    if (distance < 0) showNext();
    else showPrevious();
  }

  // Arrow-key navigation while the fullscreen viewer is open. Escape and
  // focus-trapping are handled by useOverlayBehavior.
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && activeIndex > 0) {
        event.preventDefault();
        showPrevious();
      } else if (event.key === 'ArrowRight' && activeIndex < lastIndex) {
        event.preventDefault();
        showNext();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, activeIndex, lastIndex]);

  return (
    <div
      className="flex flex-col gap-4 h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      role="region"
      aria-label={`${productTitle} product images`}
      aria-roledescription="carousel"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ── Main image / colour swatch ─────────────────────────────────── */}
      <div
        className="relative flex-1 overflow-hidden touch-pan-y"
        style={{ minHeight: '60vh' }}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            role="group"
            aria-roledescription="slide"
            aria-label={`${activeIndex + 1} of ${images.length}`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0"
            // View Transition API: morphing from product card
            style={{
              ['--view-transition-name' as string]: `product-image-${productSlug}`,
            }}
          >
            {activeIsUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active}
                alt={`${productTitle}, image ${activeIndex + 1} of ${images.length}`}
                className="w-full h-full object-cover"
                onError={() =>
                  setFailedImages((current) => ({ ...current, [activeIndex]: true }))
                }
              />
            ) : (
              <ImageFallback
                color={isUrl(active) ? undefined : active}
                title={productTitle}
                unavailable={isUrl(active)}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          onClick={showPrevious}
          disabled={activeIndex === 0}
          aria-label="Previous product image"
          className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-line bg-canvas/80 text-ink-primary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={showNext}
          disabled={activeIndex >= lastIndex}
          aria-label="Next product image"
          className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-line bg-canvas/80 text-ink-primary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 motion-reduce:transition-none"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        {/* Fullscreen trigger */}
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          aria-label="View image fullscreen"
          aria-haspopup="dialog"
          className="absolute bottom-4 left-4 z-10 flex min-h-10 items-center gap-2 border border-line bg-canvas/80 px-3 font-mono text-[9px] font-bold text-ink-secondary transition-colors hover:border-brand hover:text-brand"
        >
          <Maximize2 size={13} aria-hidden="true" />
          <span className="hidden sm:inline">FULLSCREEN</span>
        </button>

        {/* Slide counter */}
        <div
          aria-live="polite"
          className="absolute bottom-4 right-4 monospace text-[9px] text-ink-secondary pointer-events-none"
        >
          {String(activeIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
        </div>
      </div>

      {/* ── Thumbnail strip ────────────────────────────────────────────── */}
      {images.length > 1 && <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((img, i) => (
          <button
            key={i}
            id={`gallery-thumb-${i}`}
            onClick={() => {
              setActiveIndex(i);
              setIsZoomed(false);
            }}
            aria-current={i === activeIndex ? 'true' : undefined}
            className={`relative min-w-20 flex-1 aspect-square overflow-hidden transition-all duration-300
              ${i === activeIndex
                ? 'ring-2 ring-brand ring-offset-1 ring-offset-background'
                : 'opacity-50 hover:opacity-80'
              }`}
            aria-label={`View image ${i + 1}`}
          >
            {isUrl(img) && !failedImages[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={`${productTitle}, image ${i + 1}`}
                className="w-full h-full object-cover"
                onError={() => setFailedImages((current) => ({ ...current, [i]: true }))}
              />
            ) : isUrl(img) ? (
              <div className="flex h-full w-full items-center justify-center bg-surface">
                <span className="font-mono text-[8px] text-brand">N/A</span>
              </div>
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: img }} />
            )}
            {i === activeIndex && (
              <motion.div
                layoutId="thumb-indicator"
                className="absolute inset-0 ring-inset ring-2 ring-brand"
              />
            )}
          </button>
        ))}
      </div>}

      {/* ── Fullscreen viewer (portal keeps it outside the inert page) ─── */}
      {isFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${productTitle} fullscreen image viewer`}
          tabIndex={-1}
          className="fixed inset-0 z-[200] flex flex-col bg-canvas/98 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
            <span className="font-mono text-[10px] font-bold tracking-widest text-ink-secondary">
              IMAGE.VIEWER / {String(activeIndex + 1).padStart(2, '0')} OF {String(images.length).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1">
              {activeIsUrl && (
                <button
                  type="button"
                  onClick={() => setIsZoomed((value) => !value)}
                  aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
                  aria-pressed={isZoomed}
                  className="flex h-11 w-11 items-center justify-center text-ink-secondary transition-colors hover:bg-surface hover:text-ink-primary"
                >
                  {isZoomed ? <ZoomOut size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}
                </button>
              )}
              <button
                ref={closeRef}
                type="button"
                onClick={closeFullscreen}
                aria-label="Close fullscreen"
                className="flex h-11 w-11 items-center justify-center text-ink-secondary transition-colors hover:bg-surface hover:text-ink-primary"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className={`relative flex-1 ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
            <div className="flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
              {activeIsUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active}
                  alt={`${productTitle}, image ${activeIndex + 1} of ${images.length}, fullscreen`}
                  className={
                    isZoomed
                      ? 'w-[180%] max-w-none object-contain'
                      : 'max-h-full max-w-full object-contain'
                  }
                />
              ) : (
                <div className="h-full min-h-[60vh] w-full max-w-4xl">
                  <ImageFallback
                    color={isUrl(active) ? undefined : active}
                    title={productTitle}
                    unavailable={isUrl(active)}
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={showPrevious}
              disabled={activeIndex === 0}
              aria-label="Previous fullscreen image"
              className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-line bg-canvas/80 text-ink-primary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 sm:left-6"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              disabled={activeIndex >= lastIndex}
              aria-label="Next fullscreen image"
              className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-line bg-canvas/80 text-ink-primary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30 sm:right-6"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-center border-t border-line px-4 py-3">
            <span className="font-mono text-[9px] text-ink-muted">
              ESC CLOSE · ← → NAVIGATE · + ZOOM
            </span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
