"use client";

import { useState } from "react";

import { useOffline } from "~/app/_components/connectivity";
import { useIsScrubbing } from "~/app/_components/contact-list/scrub-signal";
import { MobileContactSheet } from "~/app/_components/mobile-contact-sheet";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface MobileCreateFabProps {
  canWrite: boolean;
  /** Only the contacts (people) list shows the FAB — matches the mobile design,
   *  which has no create FAB on Activity / Archived / Duplicates. */
  show?: boolean;
  /** At the plan's contact ceiling (Free 500) — hide the FAB; the near-limit
   *  banner explains why and offers Upgrade. */
  atLimit?: boolean;
}

export function MobileCreateFab({ canWrite, show = true, atLimit = false }: MobileCreateFabProps) {
  const [open, setOpen] = useState(false);
  // P42-DB01 §5a: creating a contact is a write — the FAB disables (not hides)
  // while offline; the banner above explains why.
  const offline = useOffline();
  // P46-DB04 §3·C: the FAB and the alphabet scrubber share the bottom-right
  // corner. While a scrub is running, fade the FAB and make it pointer-inert so
  // a scrub that reaches the bottom edge can't accidentally trigger it.
  const scrubbing = useIsScrubbing();

  if (!canWrite || !show || atLimit) return null;

  return (
    <>
      {/* Floating "+" button — mobile only */}
      <button
        aria-label="Create new contact"
        aria-disabled={offline}
        className="grid md:hidden"
        data-mobile-fab
        disabled={offline}
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: `calc(72px + env(safe-area-inset-bottom))`,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "#17352e",
          color: "#fff",
          border: "none",
          cursor: offline ? "default" : "pointer",
          opacity: scrubbing ? 0.35 : offline ? 0.5 : 1,
          pointerEvents: scrubbing ? "none" : undefined,
          transition: "opacity 0.12s ease",
          placeItems: "center",
          zIndex: 35,
          boxShadow: "0 6px 18px rgba(23,53,46,0.3), 0 2px 5px rgba(0,0,0,0.12)",
          WebkitTapHighlightColor: "transparent",
        }}
        type="button"
      >
        <WorkspaceIcon name="plus" size={26} strokeWidth={2.2} />
      </button>

      <MobileContactSheet isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
