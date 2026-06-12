"use client";

import { useState } from "react";

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

  if (!canWrite || !show || atLimit) return null;

  return (
    <>
      {/* Floating "+" button — mobile only */}
      <button
        aria-label="Create new contact"
        className="grid md:hidden"
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
          cursor: "pointer",
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
