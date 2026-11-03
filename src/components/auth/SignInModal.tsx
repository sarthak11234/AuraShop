'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getProviders, signIn, useSession } from 'next-auth/react';
import { X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useOverlayBehavior } from '@/hooks/useOverlayBehavior';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [providers, setProviders] = useState<string[] | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const { status } = useSession();
  const { closeRef, dialogRef } = useOverlayBehavior<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setProviders(null);
    setOptionsError(false);
    setMagicSent(false);
    setErrorMessage(null);

    getProviders()
      .then((availableProviders) => {
        if (active) setProviders(Object.keys(availableProviders ?? {}));
      })
      .catch(() => {
        if (active) setOptionsError(true);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && status === 'authenticated') onClose();
  }, [isOpen, onClose, status]);

  async function handleOAuth(provider: 'google' | 'github') {
    setErrorMessage(null);
    setLoading(provider);
    try {
      const result = await signIn(provider, { callbackUrl: '/', redirect: false });
      if (result?.error || !result?.url) {
        setErrorMessage('We could not sign you in. Please try again.');
        setLoading(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setErrorMessage('We could not sign you in. Please try again.');
      setLoading(null);
    }
  }

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || loading) return;

    setErrorMessage(null);
    setLoading('resend');
    try {
      const result = await signIn('resend', { email, redirect: false });
      if (result?.error) {
        setErrorMessage('We could not send a sign-in link. Please try again later.');
      } else {
        setMagicSent(true);
      }
    } catch {
      setErrorMessage('We could not send a sign-in link. Please try again later.');
    } finally {
      setLoading(null);
    }
  }

  const hasOAuthProvider = providers?.some((provider) => provider === 'google' || provider === 'github');
  const hasEmailProvider = providers?.includes('resend') ?? false;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : undefined}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/85 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            aria-describedby="signin-description"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 1 } : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { y: 8, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 280 }}
            className="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-6 overflow-y-auto border border-line bg-surface p-5 shadow-2xl sm:p-8"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <Link href="/" onClick={onClose} className="font-display text-sm font-bold tracking-[0.2em] text-ink-primary">
                  VEXO<span className="ml-1 text-brand" aria-hidden="true">.</span>
                </Link>
                <h2 id="signin-title" className="mt-4 font-display text-2xl font-bold tracking-tight text-ink-primary">
                  SIGN IN
                </h2>
                <p id="signin-description" className="mt-2 text-sm text-ink-secondary">
                  Continue to your VEXO account.
                </p>
              </div>
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={onClose}
                aria-label="Close sign-in"
                className="h-11 w-11 shrink-0"
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </header>

            {errorMessage && (
              <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-ink-primary">
                {errorMessage}
              </p>
            )}

            {optionsError ? (
              <p role="alert" className="text-sm text-ink-secondary">
                Sign-in options could not be loaded. Please try again.
              </p>
            ) : providers === null ? (
              <p role="status" className="font-mono text-xs text-ink-secondary">LOADING SIGN-IN OPTIONS…</p>
            ) : providers.length === 0 ? (
              <p role="status" className="text-sm text-ink-secondary">
                Sign-in is temporarily unavailable.
              </p>
            ) : (
              <>
                {hasOAuthProvider && (
                  <div className="space-y-3">
                    {providers.includes('google') && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOAuth('google')}
                        disabled={loading !== null}
                        className="min-h-12 w-full justify-start gap-3 px-4 font-mono text-[10px] uppercase tracking-widest"
                      >
                        <GoogleIcon />
                        {loading === 'google' ? 'Connecting…' : 'Continue with Google'}
                      </Button>
                    )}
                    {providers.includes('github') && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOAuth('github')}
                        disabled={loading !== null}
                        className="min-h-12 w-full justify-start gap-3 px-4 font-mono text-[10px] uppercase tracking-widest"
                      >
                        <GitHubIcon />
                        {loading === 'github' ? 'Connecting…' : 'Continue with GitHub'}
                      </Button>
                    )}
                  </div>
                )}

                {hasOAuthProvider && hasEmailProvider && (
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted">OR EMAIL</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}

                {hasEmailProvider && (
                  magicSent ? (
                    <div className="space-y-3 border border-line bg-canvas-secondary p-4" role="status">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand">
                        Check your inbox
                      </p>
                      <p className="text-sm leading-relaxed text-ink-secondary">
                        If an account can be signed in with that address, a link is on its way to{' '}
                        <span className="text-ink-primary">{email}</span>.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleMagicLink} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="signin-email" className="font-mono text-[10px] uppercase tracking-widest text-ink-secondary">
                          Email address
                        </label>
                        <input
                          id="signin-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          required
                          disabled={loading !== null}
                          className="min-h-12 w-full border border-line bg-canvas px-4 text-base text-ink-primary outline-none transition-colors placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 sm:text-sm"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={loading !== null || !email}
                        className="min-h-12 w-full font-mono text-[10px] uppercase tracking-widest"
                      >
                        {loading === 'resend' ? 'Sending link…' : 'Email me a sign-in link'}
                      </Button>
                    </form>
                  )
                )}

                {!hasOAuthProvider && !hasEmailProvider && (
                  <p role="status" className="text-sm text-ink-secondary">
                    Sign-in is temporarily unavailable.
                  </p>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
