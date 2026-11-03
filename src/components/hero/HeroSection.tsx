'use client';

import React, { useRef, useLayoutEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { gsap } from '@/lib/gsap';
import { FilmModal } from './FilmModal';
import { FashionViewerClient } from '@/components/3d/FashionViewerClient';

const HEADING_LINES = ['FUTURE IS', 'WEARABLE.'];

export interface HeroSectionProps {
  /**
   * Server-rendered product information (streams in through a Suspense
   * boundary on the page) — outfit name, collection id and live price.
   */
  productSlot?: ReactNode;
}

export function HeroSection({ productSlot }: HeroSectionProps) {
  const containerRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const [isFilmOpen, setIsFilmOpen] = useState(false);

  useLayoutEffect(() => {
    // Respect prefers-reduced-motion: skip the entrance choreography and
    // keep the hero in its natural, fully-visible final state.
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // ── 1. Collection badge drops down ────────────────────────────────
      if (badgeRef.current) {
        gsap.fromTo(
          badgeRef.current,
          { y: -25, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 }
        );
      }

      // ── 2. Headline words drop gradually from the top ──────────────────
      const words = headingRef.current?.querySelectorAll('.word-drop');
      if (words && words.length > 0) {
        gsap.fromTo(
          words,
          { yPercent: -130, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 1.2,
            ease: 'power4.out',
            stagger: 0.18,
            delay: 0.2,
          }
        );
      }

      // ── 3. Supporting copy & CTAs slide in ─────────────────────────────
      if (descRef.current) {
        gsap.fromTo(
          descRef.current,
          { y: -15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, delay: 0.45, ease: 'power3.out' }
        );
      }

      if (ctaRef.current) {
        gsap.fromTo(
          ctaRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, delay: 0.6, ease: 'power3.out' }
        );
      }

      // ── 4. Avatar stage fades in (DOM-only — never touches the canvas
      //      camera, so it cannot conflict with OrbitControls) ───────────
      if (viewerRef.current) {
        gsap.fromTo(
          viewerRef.current,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 1.1,
            delay: 0.25,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <section
        ref={containerRef}
        className="relative w-full overflow-hidden bg-canvas text-ink-primary border-b border-line"
        aria-label="Hero Showcase"
      >
        {/* ── Atmospheric Spotlight behind the Avatar (centre-right) ──── */}
        <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[560px] h-[560px] max-w-[70vw] max-h-[70vw] bg-[radial-gradient(circle,_rgba(255,255,255,0.16)_0%,_rgba(235,51,51,0.08)_45%,_transparent_70%)] pointer-events-none blur-2xl" />

        {/* ── Cyber Matrix Subtle Grid ─────────────────────────────────── */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

        <div className="relative z-10 mx-auto w-full max-w-[1800px] min-h-[80vh] lg:min-h-[88vh] pt-24 pb-10 lg:pt-28 lg:pb-14 px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center lg:items-stretch">

          {/* ── Left Column: Compact Editorial Block ───────────────────── */}
          <div className="lg:col-span-5 order-2 lg:order-1 flex flex-col justify-center gap-5 z-20">
            {/* Collection Badge */}
            <div
              ref={badgeRef}
              className="flex items-center gap-2 monospace text-[10px] sm:text-[11px] text-ink-secondary"
            >
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="font-bold tracking-widest text-brand">NEW COLLECTION</span>
              <span className="text-ink-muted">/</span>
              <span>V2.2025</span>
            </div>

            {/* Staggered Dropping Headline */}
            <div className="overflow-hidden">
              <h1
                ref={headingRef}
                className="text-4xl sm:text-6xl lg:text-7xl xl:text-[84px] font-black italic tracking-tighter leading-[0.9] text-ink-primary"
                aria-label="Future Is Wearable."
              >
                {HEADING_LINES.map((line, idx) => (
                  <span key={line} className="block overflow-hidden">
                    <span className="word-drop block">
                      {idx === 0 ? (
                        <>
                          FUTURE <span className="text-brand italic">IS</span>
                        </>
                      ) : (
                        line
                      )}
                    </span>
                  </span>
                ))}
              </h1>
            </div>

            {/* Supporting Copy */}
            <p
              ref={descRef}
              className="text-ink-secondary text-xs sm:text-sm lg:text-base leading-relaxed max-w-md"
            >
              Beyond ordinary fashion. Discover a new dimension of streetwear.
            </p>

            {/* Call to Action Buttons */}
            <div ref={ctaRef} className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1">
              <Link
                href="/collections"
                id="hero-explore-cta"
                className="group inline-flex items-center gap-3 bg-brand text-ink-primary px-7 py-3.5 font-black italic tracking-tight text-xs uppercase transition-colors duration-300 hover:bg-brand-hover hover:text-ink-primary"
              >
                <span>EXPLORE COLLECTION</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>

              <button
                onClick={() => setIsFilmOpen(true)}
                id="hero-discover-cta"
                className="monospace text-[10px] text-ink-secondary hover:text-brand px-4 py-3.5 border border-line hover:border-brand transition-all flex items-center gap-2 group cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand group-hover:scale-125 transition-transform" />
                <span>DISCOVER THE EXPERIENCE</span>
              </button>
            </div>
          </div>

          {/* ── Right Column: Dominant 3D Avatar Stage ─────────────────── */}
          <div
            ref={viewerRef}
            className="lg:col-span-7 order-1 lg:order-2 relative h-[62vh] sm:h-[66vh] lg:h-auto min-h-[340px] lg:min-h-[480px]"
          >
            {/* 3D Viewer — fills the stage, full-body framing */}
            <div className="absolute inset-0">
              <FashionViewerClient heightClass="h-full" />
            </div>

            {/* Floating Product Information (live catalogue data) */}
            <div className="absolute left-0 bottom-[4.75rem] sm:bottom-20 lg:bottom-6 z-20 w-[min(100%,280px)]">
              {productSlot}
            </div>

            {/* Technical Micro-Label: Coordinates (Far Right) */}
            <div className="hidden xl:flex absolute right-1 top-1/4 z-20 flex-col gap-1 monospace text-[8px] text-ink-muted text-right pointer-events-none">
              <span className="text-ink-primary font-bold">35.6895° N</span>
              <span>139.6917° E</span>
              <div className="w-6 h-[1px] bg-brand my-1 ml-auto" />
              <span className="text-brand font-bold">TOKYO, JAPAN</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── Functional High-Fashion Film Modal ──────────────────────── */}
      <FilmModal
        isOpen={isFilmOpen}
        onClose={() => setIsFilmOpen(false)}
        videoSrc="/videos/hero-film.mp4"
      />
    </>
  );
}
