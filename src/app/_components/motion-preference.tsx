"use client";

import { useEffect } from "react";

import type { UserPreferences } from "~/lib/preferences-shared";

// P43-01 — Animations & transitions preference, resolved at the root.
//
// Sets `data-motion` on <html> so one CSS rule family (src/styles/globals.css)
// gates movement app-wide:
//   • "system" → attribute removed; the native prefers-reduced-motion query
//     stays in charge (the default; most people never touch it).
//   • "on"     → data-motion="on"; forces motion even under OS reduced-motion.
//   • "off"    → data-motion="off"; zeroes transition/animation durations.
//
// Like <ImpersonationBanner> (P38-10), this resolves client-side after
// hydration so it does NOT force every route to render dynamically. "system"
// is a no-op with no attribute, so the common case has zero visual shift.

export type MotionPref = NonNullable<UserPreferences["motion"]>;

export function applyMotionPreference(motion: MotionPref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (motion === "system") {
    delete root.dataset.motion;
  } else {
    root.dataset.motion = motion;
  }
}

export function MotionPreference() {
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session: { user?: { preferences?: UserPreferences } } | null) => {
        if (cancelled) return;
        applyMotionPreference(session?.user?.preferences?.motion ?? "system");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
