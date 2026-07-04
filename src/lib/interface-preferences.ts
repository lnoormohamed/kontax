"use client";

// P43-01 — Interface preferences resolver.
//
// The device-class scoping model is: one saved value per preference, applied
// only where it makes sense (P43-DB01 §2·B). This module is the single seam
// that answers "is this effect honoured on this device?" so consuming
// components never re-implement the media-query scoping. It must be read once
// per surface (e.g. per contacts table) — NOT per row — so the virtualized
// list stays cheap.

import { useEffect, useState } from "react";

import type { UserPreferences } from "~/lib/preferences-shared";

// "Desktop" for applicability = a device that can actually hover with a fine
// pointer. `hover: none` (touch) ⇒ desktop-only knobs are ignored.
const DESKTOP_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Tracks whether the current device is a hover-capable desktop pointer.
 * SSR-safe: returns `false` until mounted, then resolves to the live match and
 * updates if the environment changes (e.g. a 2-in-1 switching input mode).
 */
export function useIsDesktopHover(): boolean {
  const [isDesktopHover, setIsDesktopHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(DESKTOP_HOVER_QUERY);
    const apply = () => setIsDesktopHover(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  return isDesktopHover;
}

export type ResolvedRowLabels = NonNullable<UserPreferences["rowLabels"]>;

/**
 * Resolves the effective "Labels on rows" mode for this device.
 *
 * `rowLabels` is a desktop-only knob: on touch (no hover) the saved value is
 * ignored and rows keep their shipped dot-cluster treatment ("hover"). The
 * saved value still round-trips and syncs — it's just not applied here.
 */
export function useResolvedRowLabels(
  saved: UserPreferences["rowLabels"] | undefined,
): ResolvedRowLabels {
  const isDesktopHover = useIsDesktopHover();
  if (!isDesktopHover) return "hover";
  return saved ?? "hover";
}
