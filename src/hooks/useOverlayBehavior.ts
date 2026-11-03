'use client';

import { useEffect, useRef } from 'react';

export function useOverlayBehavior<T extends HTMLElement = HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<T | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const activeElement = document.activeElement;
    lastFocusedRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    let dialogRoot: HTMLElement = dialog;
    while (dialogRoot.parentElement && dialogRoot.parentElement !== document.body) {
      dialogRoot = dialogRoot.parentElement;
    }

    const inertSiblings = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialogRoot)
      .map((element) => ({ element, wasInert: element.inert }));
    inertSiblings.forEach(({ element }) => {
      element.inert = true;
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    (closeRef.current ?? dialog).focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      inertSiblings.forEach(({ element, wasInert }) => {
        element.inert = wasInert;
      });
      if (lastFocusedRef.current?.isConnected) lastFocusedRef.current.focus();
    };
  }, [open]);

  return { closeRef, dialogRef };
}
