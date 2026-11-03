'use client';

import React, { useState, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  /** Array of colour strings or image URLs */
  images: string[];
  productTitle: string;
  productSlug: string;
}

function isUrl(str: string): boolean {
  return str.startsWith('http') || str.startsWith('/');
}

export function ImageGallery({ images, productTitle, productSlug }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const active = images[activeIndex] ?? '#1a1a1a';
  const lastIndex = images.length - 1;

  function showPrevious() {
    setActiveIndex((index) => Math.max(0, index - 1));
  }

  function showNext() {
    setActiveIndex((index) => Math.min(lastIndex, index + 1));
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
            {isUrl(active) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active}
                alt={`${productTitle}, image ${activeIndex + 1} of ${images.length}`}
                className="w-full h-full object-cover"
              />
            ) : (
              /* Colour placeholder with VEXO product grid overlay */
              <div
                className="w-full h-full flex items-center justify-center relative"
                style={{ backgroundColor: active }}
              >
                {/* Corner HUD brackets */}
                <div className="absolute inset-8 pointer-events-none">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-brand/60" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-brand/60" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-brand/60" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-brand/60" />
                </div>

                {/* Centre product label */}
                <div className="flex flex-col items-center gap-3 opacity-60">
                  <div className="w-16 h-[1px] bg-line" />
                  <span className="monospace text-ink-primary text-[11px]">
                    {productTitle}
                  </span>
                  <div className="w-16 h-[1px] bg-line" />
                </div>

                {/* Scanline overlay */}
                <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
              </div>
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
            onClick={() => setActiveIndex(i)}
            aria-current={i === activeIndex ? 'true' : undefined}
            className={`relative min-w-20 flex-1 aspect-square overflow-hidden transition-all duration-300
              ${i === activeIndex
                ? 'ring-2 ring-brand ring-offset-1 ring-offset-background'
                : 'opacity-50 hover:opacity-80'
              }`}
            aria-label={`View image ${i + 1}`}
          >
            {isUrl(img) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={`${productTitle}, image ${i + 1}`} className="w-full h-full object-cover" />
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
    </div>
  );
}
