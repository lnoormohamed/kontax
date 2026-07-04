"use client";

// P46-DB04 §3·C — a one-bit cross-component signal: "is an alphabet scrub in
// progress right now?". The scrubber (mounted deep in the contacts table) sets
// it; the mobile create-FAB (mounted in the contacts page, a separate subtree)
// reads it so it can fade + go pointer-inert while a scrub runs to the bottom
// edge. A module-level store avoids threading a prop through the whole table.

import { useSyncExternalStore } from "react";

let scrubbing = false;
const listeners = new Set<() => void>();

/** Called by the scrubber on scrub start/end (and on unmount, to fail safe). */
export function setScrubbing(next: boolean): void {
  if (scrubbing === next) return;
  scrubbing = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** True while the user is actively dragging/holding the alphabet rail. */
export function useIsScrubbing(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => scrubbing,
    () => false, // SSR: never scrubbing
  );
}
