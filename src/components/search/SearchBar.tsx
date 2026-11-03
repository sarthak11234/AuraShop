'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InstantSearch, SearchBox, Hits, useInstantSearch } from 'react-instantsearch';
import { getSearchClient, isAlgoliaConfigured, INDEX_NAME } from '@/lib/algolia';
import { Search, X } from 'lucide-react';
import Link from 'next/link';

// ── Hit shape — mirrors the records written by /api/algolia/sync ──────
interface SearchHit {
  objectID: string;
  slug: string;
  title: string;
  subtitle: string;
  price: number;
  category: string;
  categoryCode: string;
  isNew: boolean;
}

// ── Individual hit ──────────────────────────────────────────────────────
function Hit({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={`/product/${hit.slug}`}
      className="flex items-center justify-between gap-4 px-4 py-3 border-b border-line 
                 hover:bg-surface transition-colors group"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-bold italic text-sm group-hover:text-brand transition-colors">
          {hit.title}
        </span>
        <span className="monospace text-[9px] text-ink-secondary">{hit.subtitle}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {hit.isNew && (
          <span className="bg-brand text-ink-primary monospace text-[8px] px-1.5 py-0.5 font-bold">
            NEW
          </span>
        )}
        <span className="monospace text-[10px] font-bold text-brand">
          ${hit.price?.toFixed(2)}
        </span>
        <span className="text-ink-secondary text-xs group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────
function EmptyState() {
  const { results } = useInstantSearch();
  if (!results.query || results.nbHits > 0) return null;
  return (
    <div className="px-4 py-6 text-center">
      <p className="monospace text-[10px] text-ink-secondary">
        NO_RESULTS FOR &quot;{results.query}&quot;
      </p>
    </div>
  );
}

// ── Loading skeleton (shown while a query is in flight) ────────────────
function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between animate-pulse">
          <div className="h-4 bg-surface-elevated w-1/3 rounded" />
          <div className="h-4 bg-surface-elevated w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

function SearchStatus() {
  const { status } = useInstantSearch();
  if (status !== 'loading') return null;
  return <SearchSkeleton />;
}

// ── Search panel shell ─────────────────────────────────────────────────
function OfflinePanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div
        key="search-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-[100]"
      />
      <motion.div
        key="search-panel"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed top-20 left-0 right-0 z-[101] bg-surface border-b border-line shadow-xl"
      >
        <div className="max-w-[800px] mx-auto flex items-center gap-3 px-6 py-4 border-b border-line">
          <Search size={16} className="text-ink-secondary shrink-0" />
          <div className="flex-1 flex flex-col gap-1 py-1">
            <span className="monospace text-brand font-bold text-[10px]">SEARCH_OFFLINE</span>
            <span className="monospace text-[9px] text-ink-secondary">
              SET NEXT_PUBLIC_ALGOLIA_APP_ID + NEXT_PUBLIC_ALGOLIA_SEARCH_KEY TO ENABLE
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Public API ──────────────────────────────────────────────────────────
export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const searchClient = getSearchClient();

  return (
    <>
      <button
        id="header-search-trigger"
        onClick={() => setOpen(true)}
        className="p-2 rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors disabled:opacity-40"
        aria-label="Open search"
        title={isAlgoliaConfigured ? 'Search' : 'Search offline (Algolia not configured)'}
      >
        <Search size={18} />
      </button>

      {isAlgoliaConfigured && searchClient ? (
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                key="search-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-[100]"
              />

              {/* Search panel */}
              <motion.div
                key="search-panel"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="fixed top-20 left-0 right-0 z-[101] bg-surface border-b border-line shadow-xl"
              >
                <div className="max-w-[800px] mx-auto">
                  <InstantSearch
                    searchClient={searchClient}
                    indexName={INDEX_NAME}
                    future={{ preserveSharedStateOnUnmount: true }}
                  >
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-line">
                      <Search size={16} className="text-ink-secondary shrink-0" />
                      <SearchBox
                        placeholder="SEARCH NEURAL SERIES..."
                        classNames={{
                          root: 'flex-1',
                          form: 'flex-1',
                          input: 'w-full bg-transparent monospace text-[13px] font-bold text-ink-primary outline-none placeholder:text-ink-muted placeholder:font-normal uppercase',
                          reset: 'hidden',
                          submit: 'hidden',
                          loadingIcon: 'hidden',
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => setOpen(false)}
                        className="p-1 rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors"
                        aria-label="Close search"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-[60vh] overflow-y-auto" onClick={() => setOpen(false)}>
                      <EmptyState />
                      <SearchStatus />
                      <Hits
                        hitComponent={Hit}
                        classNames={{ root: 'flex flex-col', list: 'flex flex-col', item: '' }}
                      />
                    </div>

                    {/* Footer hint */}
                    <div className="flex items-center justify-between px-6 py-2 border-t border-line monospace text-[8px] text-ink-muted">
                      <span>POWERED BY ALGOLIA</span>
                      <span>↑↓ NAVIGATE · ENTER SELECT · ESC CLOSE</span>
                    </div>
                  </InstantSearch>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence>
          {open && <OfflinePanel onClose={() => setOpen(false)} />}
        </AnimatePresence>
      )}
    </>
  );
}
