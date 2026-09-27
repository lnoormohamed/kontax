"use client";

import { useEffect, useRef } from "react";

/**
 * P49A-17 — shared dialog accessibility behaviour, reused by every modal
 * (`ConfirmDialog`, `TwoFactorModal`, `RecoveryCodesDialog`,
 * `MobileBottomSheet`, the delete-account confirm):
 *
 *  - moves focus into the dialog when it opens (to `initialFocusRef`, or the
 *    dialog container itself as a fallback so Tab/Shift+Tab has something to
 *    start from);
 *  - restores focus to whatever triggered the dialog when it closes;
 *  - marks everything outside the dialog `inert` while it's open, so
 *    Tab/Shift+Tab and screen-reader "next"/virtual-cursor navigation can't
 *    leave it — a real focus trap without a manual Tab-key handler;
 *  - optionally closes on Escape (`closeOnEscape`, default true — pass
 *    `false` for dialogs that must be confirmed out of, e.g. recovery codes).
 *    Only the topmost open dialog reacts, and not while focus is inside some
 *    other dialog layered on top (e.g. a step-up password modal), so one
 *    Escape never closes two dialogs.
 *
 * Attach the returned ref to the dialog's outermost element. A backdrop that
 * is a *sibling* of that element (bottom sheets) must carry
 * `data-dialog-backdrop`, or it would be made inert and stop receiving taps.
 */
const openDialogs: object[] = [];

export function useDialogFocus<T extends HTMLElement>({
  open,
  onClose,
  closeOnEscape = true,
  initialFocusRef,
}: {
  open: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<T | null>(null);

  // Latest-ref pattern: the effect below only re-runs when `open` flips, but
  // `onClose`/`closeOnEscape` can legitimately change while it stays open
  // (e.g. a "busy" flag that disables Escape mid-submit) — read through refs
  // so Escape always sees the current values instead of the ones captured
  // when the dialog opened.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const trigger = document.activeElement as HTMLElement | null;

    // Mark every sibling of every ancestor (up to <body>) inert, so the
    // dialog is the only interactive/focusable content on the page. Skip
    // anything already inert (e.g. a dialog opened from inside another one)
    // so we don't clear someone else's inert on the way out.
    const madeInert: HTMLElement[] = [];
    if (container) {
      let node: HTMLElement = container;
      while (node.parentElement) {
        const parent: HTMLElement = node.parentElement;
        for (const child of Array.from(parent.children)) {
          if (
            child !== node &&
            child instanceof HTMLElement &&
            !child.hasAttribute("inert") &&
            !child.hasAttribute("data-dialog-backdrop")
          ) {
            child.setAttribute("inert", "");
            madeInert.push(child);
          }
        }
        if (parent === document.body) break;
        node = parent;
      }
    }

    (initialFocusRef?.current ?? container)?.focus();

    const token = {};
    openDialogs.push(token);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !closeOnEscapeRef.current) return;
      if (openDialogs[openDialogs.length - 1] !== token) return;
      // Focus inside another element outside this dialog means a dialog that
      // doesn't use this hook is on top; it handles its own Escape.
      const target = e.target;
      if (container && target instanceof Node && target !== document.body && !container.contains(target)) return;
      onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      for (const el of madeInert) el.removeAttribute("inert");
      trigger?.focus();
    };
    // Re-running this on every onClose/initialFocusRef identity change would
    // re-trigger the inert/focus dance; it should only run when `open` flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return containerRef;
}
