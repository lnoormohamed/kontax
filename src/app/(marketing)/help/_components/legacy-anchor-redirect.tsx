"use client";

import { useEffect } from "react";

/**
 * P50A-05 · Keeps old single-page links (/help#carddav, /help#provider-icloud…)
 * working: fragments never reach the server, so the hub maps them client-side
 * and replaces the history entry with the new article URL.
 */
export function LegacyAnchorRedirect({ map }: { map: Readonly<Record<string, string>> }) {
  useEffect(() => {
    const redirect = () => {
      const anchor = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      const target = anchor ? map[anchor] : undefined;
      if (target) window.location.replace(target);
    };
    redirect();
    window.addEventListener("hashchange", redirect);
    return () => window.removeEventListener("hashchange", redirect);
  }, [map]);

  return null;
}
