"use client";

import { useEffect, useRef } from "react";

// Keeps Tab / Shift-Tab inside an overlay (modal, slide-over) while open, and
// restores focus to the previously-focused element on close (P21 a11y).
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    const SEL =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const list = () =>
      Array.from(el.querySelectorAll<HTMLElement>(SEL)).filter((n) => n.offsetParent !== null);

    if (!el.contains(document.activeElement)) {
      const f = list();
      if (f[0]) setTimeout(() => f[0]!.focus(), 0);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = list();
      if (f.length === 0) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [active]);

  return ref;
}
