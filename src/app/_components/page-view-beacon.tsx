"use client";

import { useEffect } from "react";

// P50A-08 — cookieless page-view beacon for content pages.
//
// Mount this once per page (guides, compare, help, for, features, and
// /register for the conversion count) with that page's own path. It fires a
// single `navigator.sendBeacon` on mount and nothing else: no cookies, no
// per-visitor identifier, no polling, no render output. The server route
// (/api/metrics/pv) re-validates `path` against its own allow-list before
// counting anything, so mounting this on a page outside that list is a no-op
// server-side, not a way to expand what gets tracked.
export function PageViewBeacon({ path }: { path: string }) {
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    try {
      const payload = new Blob([JSON.stringify({ path })], { type: "application/json" });
      navigator.sendBeacon("/api/metrics/pv", payload);
    } catch {
      // Best-effort only — a beacon failure must never affect the page.
    }
  }, [path]);

  return null;
}
