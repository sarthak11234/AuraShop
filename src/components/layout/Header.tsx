'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShoppingBag, Menu, User, LogOut, ChevronDown, X, Heart } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/store/cartStore';
import { SignInModal } from '@/components/auth/SignInModal';
import { SearchTrigger } from '@/components/search/SearchBar';
import { Button } from '@/components/ui/button';
import { useOverlayBehavior } from '@/hooks/useOverlayBehavior';
import { useWishlistStore } from '@/store/wishlistStore';

const NAV_ITEMS: Array<{
  label: string;
  kind?: 'mega';
  href?: string;
}> = [
  { label: 'THE EDIT', href: '/' },
  { label: 'COLLECTIONS', kind: 'mega', href: '/collections' },
  { label: 'MATERIALS', href: '/#materials' },
  { label: 'TECH LAB', href: '/collections?category=TECH' },
];

type NavigationLinksProps = {
  variant: 'desktop' | 'mobile';
  pathname: string;
  category: string | null;
  isMegaMenuOpen?: boolean;
  onOpenMegaMenu?: () => void;
  onNavigate?: () => void;
};

const NavigationLinkList = ({
  variant,
  pathname,
  category,
  isMegaMenuOpen = false,
  onOpenMegaMenu,
  onNavigate,
}: NavigationLinksProps) => {
  const isActive = (href: string) => {
    const [base, query] = href.split('?');
    const normalizedPathname = pathname.toLowerCase();

    if (href === '/collections') {
      return (
        (pathname === base && category?.toUpperCase() !== 'TECH') ||
        (normalizedPathname.startsWith(`${base}/`) && normalizedPathname !== `${base}/tech`)
      );
    }

    if (query) {
      const targetParams = new URLSearchParams(query);
      const matchesTargetQuery = [...targetParams.entries()].every(
        ([key, value]) =>
          key === 'category'
            ? category?.toUpperCase() === value.toUpperCase()
            : false,
      );

      return (
        (pathname === base && matchesTargetQuery) ||
        normalizedPathname === `${base}/tech`
      );
    }

    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return NAV_ITEMS.map((item) => {
    const href = item.href ?? '/collections';
    const active = isActive(href);
    const activeClass = active ? 'text-ink-primary' : 'text-ink-secondary hover:text-ink-primary';

    if (variant === 'desktop') {
      return (
        <Link
          key={item.label}
          href={href}
          onMouseEnter={item.kind === 'mega' ? onOpenMegaMenu : undefined}
          onFocus={item.kind === 'mega' ? onOpenMegaMenu : undefined}
          aria-haspopup={item.kind === 'mega' ? 'true' : undefined}
          aria-expanded={item.kind === 'mega' ? isMegaMenuOpen : undefined}
          aria-controls={item.kind === 'mega' ? 'header-collections-menu' : undefined}
          aria-current={active ? 'page' : undefined}
          className={`vexo-primary-link group relative flex items-center uppercase transition-colors ${activeClass}`}
        >
          <span className="vexo-nav-slash" aria-hidden="true">/</span>
          <span>{item.label}</span>
          {active && <span className="vexo-nav-active-dot" aria-hidden="true" />}
        </Link>
      );
    }

    return (
      <Link
        key={item.label}
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`font-display text-sm font-bold uppercase tracking-widest transition-colors py-3 border-b border-line ${activeClass}`}
      >
        {item.label}
      </Link>
    );
  });
};

const SearchAwareNavigationLinks = ({
  variant,
  pathname,
  ...props
}: Omit<NavigationLinksProps, 'category'>) => {
  const searchParams = useSearchParams();

  return (
    <NavigationLinkList
      variant={variant}
      pathname={pathname}
      category={searchParams.get('category')}
      {...props}
    />
  );
};

const ActiveNavigationLinks = (props: Omit<NavigationLinksProps, 'category'>) => (
  <React.Suspense fallback={<NavigationLinkList {...props} category={null} />}>
    <SearchAwareNavigationLinks {...props} />
  </React.Suspense>
);

export const Header = () => {
  const [isMegaMenuOpen, setIsMegaMenuOpen] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isSignInOpen, setIsSignInOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);
  const userMenuButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const toggleCart = useCartStore((state) => state.toggleCart);
  const isCartOpen = useCartStore((state) => state.isCartOpen);
  const itemCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantity, 0));
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const { data: session } = useSession();
  const pathname = usePathname();
  const { closeRef: mobileCloseRef, dialogRef: mobileMenuRef } = useOverlayBehavior<HTMLElement>(
    isMobileOpen,
    () => setIsMobileOpen(false),
  );
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    void useWishlistStore.persist.rehydrate();
    void useCartStore.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setIsUserMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isUserMenuOpen]);

  async function handleSignOut(onSuccess?: () => void) {
    setIsSigningOut(true);
    setSignOutError(false);
    try {
      await signOut({ callbackUrl: '/' });
      onSuccess?.();
    } catch {
      setSignOutError(true);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <header className="vexo-header fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas">
        <div className="vexo-header-inner mx-auto grid max-w-[1800px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:px-6 lg:px-8">
          <div className="vexo-header-meta flex items-center gap-5 font-mono text-[10px] text-ink-secondary">
            <div className="flex flex-col leading-4">
              <span className="text-ink-muted">EDITION</span>
              <span className="text-ink-primary">RELEASE.01</span>
            </div>
            <div className="h-9 w-px bg-line" aria-hidden="true" />
            <div className="flex flex-col leading-4">
              <span className="text-ink-muted">SUBSYSTEM</span>
              <span className="text-brand">NEURAL_SYS</span>
            </div>
          </div>

          <Link
            href="/"
            aria-label="VEXO — Future is wearable. Home"
            className="vexo-header-logo group col-start-2 flex flex-col items-center justify-center"
          >
            <span className="vexo-wordmark flex items-baseline font-display text-ink-primary transition-colors group-hover:text-ink-primary">
              <span>VEXO</span>
              <span className="vexo-wordmark-dot" aria-hidden="true" />
            </span>
            <span className="vexo-tagline font-mono text-ink-secondary">FUTURE IS WEARABLE.</span>
          </Link>

          <nav className="vexo-primary-nav col-start-3 flex items-center justify-self-end" aria-label="Primary">
            <div className="vexo-primary-links hidden items-center font-mono">
              <ActiveNavigationLinks
                variant="desktop"
                pathname={pathname}
                isMegaMenuOpen={isMegaMenuOpen}
                onOpenMegaMenu={() => setIsMegaMenuOpen(true)}
              />
            </div>

            <div className="vexo-header-actions flex items-center border-l border-line">
              <SearchTrigger />

              <Link
                href="/wishlist"
                className="vexo-wishlist-control relative flex items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink-primary"
                aria-label={`Open wishlist, ${wishlistCount} ${wishlistCount === 1 ? 'item' : 'items'}`}
              >
                <Heart size={18} aria-hidden="true" />
                {wishlistCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[8px] font-bold text-ink-primary">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                onClick={toggleCart}
                id="header-cart-btn"
                className="vexo-header-icon relative flex items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink-primary"
                aria-label={`Open cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
                aria-expanded={isCartOpen}
              >
                <ShoppingBag size={18} aria-hidden="true" />
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1 -right-1 bg-brand text-ink-primary text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </button>

              {session?.user ? (
                <div className="vexo-account-wrap relative" ref={userMenuRef}>
                  <button
                    ref={userMenuButtonRef}
                    id="header-user-menu"
                    onClick={() => setIsUserMenuOpen((v) => !v)}
                    className="vexo-account-button flex items-center gap-2 rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink-primary"
                    aria-label={`Account menu for ${session.user.name ?? session.user.email ?? 'VEXO member'}`}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                    aria-controls="header-account-menu"
                  >
                    {session.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.user.image}
                        alt={session.user.name ?? 'User'}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <User size={18} />
                    )}
                    <ChevronDown size={12} className={`transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        id="header-account-menu"
                        role="menu"
                        aria-label="Account options"
                        className="absolute top-full right-0 mt-2 w-64 border border-line bg-surface shadow-lg z-50"
                      >
                        <div role="group" aria-label="Signed-in account" className="px-4 py-3 border-b border-line">
                          <p className="font-mono text-[9px] font-bold tracking-widest text-brand">VEXO MEMBER</p>
                          <p className="mt-1 truncate text-sm font-semibold text-ink-primary">
                            {session.user.name ?? 'Welcome back'}
                          </p>
                          {session.user.email && (
                            <p className="mt-1 truncate font-mono text-[10px] text-ink-muted">{session.user.email}</p>
                          )}
                        </div>
                        {signOutError && (
                          <p role="alert" className="px-4 py-3 text-xs text-ink-secondary">
                            Sign out failed. Please try again.
                          </p>
                        )}
                        <button
                          id="header-signout"
                          role="menuitem"
                          onClick={() => void handleSignOut()}
                          disabled={isSigningOut}
                          className="w-full flex items-center gap-3 px-4 py-3 font-mono text-[10px] text-ink-secondary hover:bg-surface-elevated transition-colors border-t border-line disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <LogOut size={12} />
                          {isSigningOut ? 'SIGNING OUT…' : 'SIGN OUT'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Button
                  id="header-signin-btn"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSignInOpen(true)}
                  className="vexo-sign-in h-9 gap-2 font-mono text-[10px] font-bold uppercase tracking-widest"
                  aria-label="Sign in"
                >
                  <User size={14} />
                  <span className="vexo-sign-in-label">SIGN IN</span>
                </Button>
              )}

              <button
                className="vexo-mobile-menu flex items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface hover:text-ink-primary"
                aria-label="Mobile menu"
                aria-expanded={isMobileOpen}
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu size={18} aria-hidden="true" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              transition={reduceMotion ? { duration: 0 } : undefined}
              className="absolute inset-0 bg-canvas/90 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.aside
              ref={mobileMenuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              tabIndex={-1}
              initial={reduceMotion ? { x: 0 } : { x: '100%' }}
              animate={{ x: 0 }}
              exit={reduceMotion ? { x: 0 } : { x: '100%' }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute inset-y-0 right-0 z-10 flex h-[100dvh] w-[min(20rem,85vw)] flex-col border-l border-line bg-surface pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex h-20 items-center justify-between border-b border-line px-6">
                <span className="font-display text-2xl font-normal tracking-[0.3em] text-ink-primary">VEXO</span>
                <button
                  ref={mobileCloseRef}
                  type="button"
                  className="p-2 rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors"
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-2" aria-label="Mobile">
                <ActiveNavigationLinks
                  variant="mobile"
                  pathname={pathname}
                  onNavigate={() => setIsMobileOpen(false)}
                />
              </nav>

              <div className="flex flex-col gap-4 border-t border-line p-5 sm:p-6">
                <Link
                  href="/wishlist"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex min-h-12 items-center justify-between border border-line px-4 font-mono text-[10px] font-bold uppercase tracking-widest text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
                >
                  <span>WISHLIST</span>
                  <span>{wishlistCount} {wishlistCount === 1 ? 'ITEM' : 'ITEMS'}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleCart();
                    setIsMobileOpen(false);
                  }}
                  className="flex min-h-12 w-full items-center justify-between border border-line px-4 text-ink-secondary transition-colors hover:border-brand hover:text-ink-primary"
                  aria-label="Open cart"
                  aria-expanded={isCartOpen}
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest">BAG</span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                </button>
                {session?.user ? (
                  <>
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] font-bold tracking-widest text-brand">VEXO MEMBER</p>
                      <p className="mt-1 truncate text-sm font-semibold text-ink-primary">
                        {session.user.name ?? 'Welcome back'}
                      </p>
                      {session.user.email && (
                        <p className="mt-1 truncate font-mono text-[10px] text-ink-muted">{session.user.email}</p>
                      )}
                    </div>
                    {signOutError && (
                      <p role="alert" className="text-xs text-ink-secondary">Sign out failed. Please try again.</p>
                    )}
                    <Button
                      type="button"
                      onClick={() => void handleSignOut(() => setIsMobileOpen(false))}
                      disabled={isSigningOut}
                      className="min-h-12 w-full font-mono text-[10px] uppercase tracking-widest"
                    >
                      {isSigningOut ? 'Signing out…' : 'Sign out'}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setIsSignInOpen(true);
                      setIsMobileOpen(false);
                    }}
                    className="min-h-12 w-full font-mono text-[10px] uppercase tracking-widest"
                  >
                    SIGN IN
                  </Button>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMegaMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onMouseLeave={() => setIsMegaMenuOpen(false)}
            id="header-collections-menu"
            className="absolute top-full left-0 w-full bg-surface border-b border-line overflow-hidden z-40"
          >
            <div className="max-w-[1800px] mx-auto p-12 grid grid-cols-4 gap-12">
              {[
                { title: 'Outerwear', code: '01', href: '/collections?category=OUTERWEAR' },
                { title: 'Technical Gear', code: '02', href: '/collections?category=GEAR' },
                { title: 'Tech', code: '03', href: '/collections?category=TECH' },
                { title: 'Accessories', code: '04', href: '/collections?category=ACCESSORY' },
              ].map((cat) => (
                <div key={cat.title} className="flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-line pb-2">
                    <h3 className="text-xl font-bold font-display italic">{cat.title}</h3>
                    <span className="font-mono text-brand">{cat.code}</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    <li>
                      <Link
                        href={cat.href}
                        onClick={() => setIsMegaMenuOpen(false)}
                        className="text-ink-secondary hover:text-ink-primary transition-colors font-mono text-[12px]"
                      >
                        Explore collection →
                      </Link>
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign-In Modal (rendered outside header for proper stacking) */}
      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </>
  );
};
